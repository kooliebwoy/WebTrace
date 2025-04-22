import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getDnsModule } from '$lib/server/node-compat';
import { getTimers } from '$lib/server/node-compat';
import { promisify } from 'util';

// Define global DNS servers for propagation checking - only use the most reliable ones
const DNS_SERVERS = [
  { name: 'Google', ip: '8.8.8.8', location: 'Global', provider: 'Google' },
  { name: 'Cloudflare', ip: '1.1.1.1', location: 'Global', provider: 'Cloudflare' },
  { name: 'Quad9', ip: '9.9.9.9', location: 'Global', provider: 'Quad9' },
  { name: 'OpenDNS', ip: '208.67.222.222', location: 'Global', provider: 'Cisco' },
  { name: 'Level3', ip: '4.2.2.2', location: 'US', provider: 'CenturyLink' },
  { name: 'Verisign', ip: '64.6.64.6', location: 'US', provider: 'Verisign' }
];

interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

interface DNSPropagationResult {
  server: {
    name: string;
    ip: string;
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
    try {
      const data = await request.formData();
      const domain = data.get('domain')?.toString()?.trim() || '';
      const recordType = data.get('recordType')?.toString()?.trim().toUpperCase() || 'A';
      
      if (!domain) {
        return fail(400, { error: 'Domain name is required' });
      }
      
      console.log(`[Server Action] Checking DNS propagation for ${domain}, record type: ${recordType}`);
      
      // Create individual queries with strict timeouts
      const queryPromises = DNS_SERVERS.map(async server => {
        // Wrap each DNS query in a timeout
        try {
          // Set a very short 2-second timeout for each query
          const { setTimeout } = await getTimers();
          
          // Create a promise that will resolve to null after the timeout
          const timeoutPromise = new Promise<null>(resolve => {
            setTimeout(() => resolve(null), 2000);
          });
          
          // Race the actual query against the timeout
          const result = await Promise.race([
            querySingleServer(domain, recordType, server),
            timeoutPromise
          ]);
          
          // If we got a null result, the timeout won
          if (result === null) {
            return {
              server,
              records: [],
              propagated: false,
              responseTime: 2000,
              error: 'Query timed out after 2 seconds'
            };
          }
          
          return result;
        } catch (error) {
          // Fallback for any errors
          return {
            server,
            records: [],
            propagated: false,
            responseTime: 0,
            error: error.message || 'Query failed'
          };
        }
      });
      
      // Wait for all queries to complete (with timeouts)
      const results = await Promise.all(queryPromises);
      
      // Calculate propagation percentage
      const propagatedCount = results.filter(r => r.propagated).length;
      const propagationPercentage = propagatedCount > 0 ? 
        (propagatedCount / results.length) * 100 : 0;
      
      // Check if records are consistent
      const isConsistent = checkConsistency(results);
      
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
  const queryPromises = DNS_SERVERS.map(server => {
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
        server: DNS_SERVERS[index],
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
  server: { name: string; ip: string; location: string; provider: string },
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

// Query a single DNS server for records
async function querySingleServer(
  domain: string, 
  recordType: string, 
  server: { name: string; ip: string; location: string; provider: string }
): Promise<DNSPropagationResult> {
  const startTime = Date.now();
  
  try {
    // Get DNS module with our compatibility layer
    const dns = await getDnsModule();
    
    // Set DNS server resolver
    const resolver = new dns.promises.Resolver();
    resolver.setServers([server.ip]);
    
    // Query the appropriate record type
    let records: DNSRecord[] = [];
    
    switch (recordType) {
      case 'A':
        const aRecords = await resolver.resolve4(domain);
        records = aRecords.map(r => ({ type: 'A', value: r }));
        break;
      case 'AAAA':
        const aaaaRecords = await resolver.resolve6(domain);
        records = aaaaRecords.map(r => ({ type: 'AAAA', value: r }));
        break;
      case 'MX':
        const mxRecords = await resolver.resolveMx(domain);
        records = mxRecords.map(r => ({ 
          type: 'MX', 
          value: `${r.priority} ${r.exchange}`,
          ttl: r.ttl
        }));
        break;
      case 'TXT':
        const txtRecords = await resolver.resolveTxt(domain);
        records = txtRecords.map(r => ({ 
          type: 'TXT', 
          value: Array.isArray(r) ? r.join('') : r
        }));
        break;
      case 'NS':
        const nsRecords = await resolver.resolveNs(domain);
        records = nsRecords.map(r => ({ type: 'NS', value: r }));
        break;
      case 'CNAME':
        const cnameRecords = await resolver.resolveCname(domain);
        records = cnameRecords.map(r => ({ type: 'CNAME', value: r }));
        break;
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }
    
    const responseTime = Date.now() - startTime;
    
    return {
      server,
      records,
      propagated: records.length > 0,
      responseTime
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
    const resultValues = result.records.map(r => r.value).sort();
    const referenceValues = referenceRecords.map(r => r.value).sort();
    
    return JSON.stringify(resultValues) === JSON.stringify(referenceValues);
  });
}
