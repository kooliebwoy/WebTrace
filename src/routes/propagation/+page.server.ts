import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { dohQuery } from '$lib/server/doh';
import { normalizeTxtRecord } from '$lib/server/txt-normalization';

// Define DoH servers for propagation checking - only tested working endpoints
const DOH_SERVERS = [
  { name: 'Google', url: 'https://dns.google/resolve', location: 'Global', provider: 'Google' },
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query', location: 'Global', provider: 'Cloudflare' },
  { name: 'Cloudflare (Mozilla)', url: 'https://mozilla.cloudflare-dns.com/dns-query', location: 'Global', provider: 'Cloudflare' },
  { name: 'NextDNS', url: 'https://dns.nextdns.io/dns-query', location: 'Global', provider: 'NextDNS' },
  { name: 'AliDNS', url: 'https://dns.alidns.com/resolve', location: 'Asia', provider: 'Alibaba' },
  { name: 'DNS.SB', url: 'https://doh.sb/dns-query', location: 'Global', provider: 'DNS.SB' }
];

interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

interface DNSPropagationResult {
  server: {
    name: string;
    url: string;
    location: string;
    provider: string;
  };
  records: DNSRecord[];
  propagated: boolean;
  responseTime: number;
  error?: string;
}

export const actions = {
  // Simple single-stage DNS propagation check
  checkPropagation: async ({ request }) => {
    console.log('[Propagation] Starting checkPropagation action');
    try {
      const data = await request.formData();
      const domain = data.get('domain')?.toString()?.trim() || '';
      const recordType = data.get('recordType')?.toString()?.trim().toUpperCase() || 'A';
      
      if (!domain) {
        console.log('[Propagation] No domain provided');
        return fail(400, { error: 'Domain name is required' });
      }
      
      console.log(`[Propagation] Checking DNS propagation for ${domain}, record type: ${recordType}`);
      
      // Query servers one by one like DNS lookup does, not simultaneously
      const results: DNSPropagationResult[] = [];
      
      for (const server of DOH_SERVERS) {
        console.log(`[Propagation] Querying ${server.name}...`);
        try {
          const result = await querySingleServer(domain, recordType, server);
          results.push(result);
          console.log(`[Propagation] ${server.name} completed: ${result.propagated ? 'success' : 'failed'}`);
        } catch (error) {
          console.error(`[Propagation] ${server.name} error:`, error);
          results.push({
            server,
            records: [],
            propagated: false,
            responseTime: 0,
            error: error.message
          });
        }
      }
      
      // Calculate propagation percentage
      const propagatedCount = results.filter(r => r.propagated).length;
      const propagationPercentage = propagatedCount > 0 ? 
        (propagatedCount / results.length) * 100 : 0;
      
      // Check if records are consistent
      const isConsistent = checkConsistency(results);
      
      console.log(`[Propagation] Returning results: ${propagatedCount}/${results.length} propagated (${propagationPercentage}%)`);
      
      return {
        domain,
        recordType,
        results,
        propagationPercentage,
        isConsistent,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[Server Action] DNS propagation check error:', error);
      return fail(500, { error: error.message || 'Failed to check DNS propagation' });
    }
  }
} satisfies Actions;

// Query multiple DNS servers in parallel but with timeout protection
async function queryMultipleServers(domain: string, recordType: string): Promise<DNSPropagationResult[]> {
  // Create a timeout promise for each server (3 seconds max per server)
  const queryPromises = DOH_SERVERS.map(server => {
    // Create a timeout protection for each query
    return Promise.race([
      querySingleServer(domain, recordType, server),
      // Timeout after 3 seconds for any individual server
      new Promise<DNSPropagationResult>(resolve => {
        setTimeout(() => {
          resolve({
            server,
            records: [],
            propagated: false,
            responseTime: 3000,
            error: 'Query timed out after 3 seconds'
          });
        }, 3000);
      })
    ]);
  });
  
  // Use Promise.allSettled to ensure all queries complete even if some fail
  const results = await Promise.allSettled(queryPromises);
  
  // Process and return results, handling any failures
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Handle rejected promises
      return {
        server: DOH_SERVERS[index],
        records: [],
        propagated: false,
        responseTime: 0,
        error: `Query failed: ${result.reason}`
      };
    }
  });
}

// Query a single DNS server with timeout protection
async function querySingleServerWithTimeout(
  domain: string, 
  recordType: string, 
  server: { name: string; url: string; location: string; provider: string },
  timeoutMs: number = 3000
): Promise<DNSPropagationResult> {
  return Promise.race([
    querySingleServer(domain, recordType, server),
    new Promise<DNSPropagationResult>(resolve => {
      setTimeout(() => {
        resolve({
          server,
          records: [],
          propagated: false,
          responseTime: timeoutMs,
          error: `Query timed out after ${timeoutMs}ms`
        });
      }, timeoutMs);
    })
  ]);
}

// Query a single DNS server for records using DoH
async function querySingleServer(
  domain: string, 
  recordType: string, 
  server: { name: string; url: string; location: string; provider: string }
): Promise<DNSPropagationResult> {
  const startTime = Date.now();
  
  try {
    // Use DoH query with 2 second timeout
    const result = await dohQuery(server.url, domain, recordType, 2000);
    
    return {
      server,
      records: result.records,
      propagated: result.records.length > 0,
      responseTime: result.elapsed
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`DNS query error for ${server.name}:`, error);
    
    return {
      server,
      records: [],
      propagated: false,
      responseTime,
      error: error.message
    };
  }
}

// Check if records are consistent across all servers that have propagated
function checkConsistency(results: DNSPropagationResult[]): boolean {
  const propagatedResults = results.filter(r => r.propagated && r.records.length > 0);
  
  if (propagatedResults.length <= 1) {
    return true; // Only one server has records, so they're "consistent"
  }
  
  // Use the first server's records as reference
  const referenceRecords = propagatedResults[0].records;
  
  // Compare each server's records with the reference
  return propagatedResults.every(result => {
    // Must have same number of records
    if (result.records.length !== referenceRecords.length) {
      return false;
    }
    
    // Check if all values match (ignoring order)
    // For TXT records, normalize values according to RFC 1035 before comparison
    const resultValues = result.records.map(r => {
      if (r.type === 'TXT') {
        // TXT records may come as multi-string arrays, normalize for comparison
        return normalizeTxtRecord(r.value);
      }
      return r.value;
    }).sort();
    
    const referenceValues = referenceRecords.map(r => {
      if (r.type === 'TXT') {
        // TXT records may come as multi-string arrays, normalize for comparison
        return normalizeTxtRecord(r.value);
      }
      return r.value;
    }).sort();
    
    return JSON.stringify(resultValues) === JSON.stringify(referenceValues);
  });
}
