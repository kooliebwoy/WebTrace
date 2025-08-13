import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { dohQuery, type DNSRecord as DoHDNSRecord } from '$lib/server/doh';

// DNS servers with DoH endpoints
const DNS_SERVERS = [
  { name: 'Cloudflare', doh: 'https://cloudflare-dns.com/dns-query', location: 'Global', provider: 'Cloudflare' },
  { name: 'Google', doh: 'https://dns.google/resolve', location: 'Global', provider: 'Google' },
  { name: 'Quad9', doh: 'https://dns.quad9.net/dns-query', location: 'Global', provider: 'Quad9' }
];

// Helper function to query a single DNS server using DoH
async function querySingleServer(
  domain: string,
  recordType: string,
  server: { name: string; doh: string; location: string; provider: string },
  timeoutMs: number = 3000
): Promise<{type: string; data: string; ttl?: number; priority?: number}[]> {
  try {
    const result = await dohQuery(server.doh, domain, recordType, timeoutMs);
    
    return result.records.map(record => {
      // Handle special formatting for certain record types
      let data = record.value;
      let priority: number | undefined;
      
      // For MX records, extract priority if it's in the value
      if (recordType === 'MX' && record.value.includes(' ')) {
        const parts = record.value.split(' ');
        const possiblePriority = parseInt(parts[0]);
        if (!isNaN(possiblePriority)) {
          priority = possiblePriority;
          data = parts.slice(1).join(' ');
        }
      }
      
      return {
        type: recordType,
        data: data,
        ttl: record.ttl,
        priority
      };
    });
  } catch (error) {
    console.log(`[Server Action] DoH query failed for ${server.name}: ${error.message}`);
    return [];
  }
}

export const actions: Actions = {
  dnsLookup: async ({ request }) => {
    console.log('[Server Action] dnsLookup started.');

    const formData = await request.formData();
    const domain = formData.get('domain');
    const recordTypes = formData.get('recordTypes');
    console.log('[Server Action] Received domain:', domain);
    console.log('[Server Action] Requested record types:', recordTypes);

    if (!domain || typeof domain !== 'string') {
      console.error('[Server Action] Error: No domain provided.');
      return fail(400, { error: 'No domain provided' });
    }
    
    // Parse requested record types (if provided)
    const requestedTypes = recordTypes ? (recordTypes as string).split(',') : [];
    
    // First, just remove protocol
    let inputDomain = domain.trim()
      .replace(/^https?:\/\//i, '');  // Remove http:// or https://
    
    // Split path if present
    inputDomain = inputDomain.split('/')[0];
    
    // For CNAME specific lookups, we keep www. prefix if it exists
    let lookupDomain = inputDomain;
    
    // Determine if we have a www subdomain
    const hasWww = inputDomain.startsWith('www.');
    
    // For most record types, we want to strip www prefix
    let cleanedDomain = hasWww ? inputDomain.replace(/^www\./i, '') : inputDomain;
    
    console.log(`[Server Action] Original domain: ${domain}`);
    console.log(`[Server Action] Input domain after cleaning: ${inputDomain}`);
    console.log(`[Server Action] Root domain for most lookups: ${cleanedDomain}`);
    if (hasWww) {
      console.log(`[Server Action] Will check CNAME records for: ${inputDomain}`);
    }
    
    try {
      // Initialize array to store all DNS records
      const records: Array<{type: string; data: string; ttl?: number; priority?: number}> = [];

      // Helper function to safely run DoH DNS lookups with timeout protection  
      const safeDohLookup = async (domain: string, recordType: string) => {
        try {
          // Use Cloudflare as the primary DoH server (first in DNS_SERVERS list)
          const primaryServer = DNS_SERVERS[0];
          const foundRecords = await querySingleServer(domain, recordType, primaryServer, 3000);
          
          // Add found records to our collection
          foundRecords.forEach(record => {
            records.push(record);
          });
          
          console.log(`[Server Action] Found ${foundRecords.length} ${recordType} records for ${domain}`);
        } catch (error) {
          console.log(`[Server Action] No ${recordType} records found or error:`, error.message);
          // We don't fail here, just continue with other record types
        }
      };
      
      // Only perform lookups if no specific types requested or the specific type is requested
      
      // Look up A records (IPv4) for the main domain
      if (requestedTypes.length === 0 || requestedTypes.includes('A')) {
        await safeDohLookup(cleanedDomain, 'A');
        
        // If the user is querying CNAME but not explicitly A records,
        // and we have a www domain or need to check www, check A records for the www subdomain too
        // since many sites implement www as direct A records instead of CNAMEs
        if (requestedTypes.includes('CNAME') && !requestedTypes.includes('A')) {
          const wwwDomain = hasWww ? inputDomain : `www.${cleanedDomain}`;
          try {
            const primaryServer = DNS_SERVERS[0];
            const wwwARecords = await querySingleServer(wwwDomain, 'A', primaryServer, 3000);
            wwwARecords.forEach(record => {
              records.push({ ...record, type: 'A (www)' });
            });
          } catch (error) {
            console.log(`[Server Action] No A (www) records found for ${wwwDomain}`);
          }
        }
      }
      
      // Look up AAAA records (IPv6)
      if (requestedTypes.length === 0 || requestedTypes.includes('AAAA')) {
        await safeDohLookup(cleanedDomain, 'AAAA');
      }
      
      // Look up MX records
      if (requestedTypes.length === 0 || requestedTypes.includes('MX')) {
        await safeDohLookup(cleanedDomain, 'MX');
      }
      
      // Look up TXT records - always fetch as they may contain SPF
      if (requestedTypes.length === 0 || requestedTypes.includes('TXT') || requestedTypes.includes('SPF')) {
        await safeDohLookup(cleanedDomain, 'TXT');
      }
      
      // Look up NS records
      if (requestedTypes.length === 0 || requestedTypes.includes('NS')) {
        await safeDohLookup(cleanedDomain, 'NS');
      }
      
      // Look up CNAME records
      if (requestedTypes.length === 0 || requestedTypes.includes('CNAME')) {
        // For www subdomains or www checks, we need to check both CNAME and A records
        // since some domains configure www with CNAME and others with direct A records
        const domainToCheck = hasWww ? inputDomain : `www.${cleanedDomain}`;
        
        console.log(`[Server Action] Looking up CNAME for: ${domainToCheck}`);
        
        try {
          await safeDohLookup(domainToCheck, 'CNAME');
          console.log(`[Server Action] CNAME records found for ${domainToCheck}`);
        } catch (err) {
          console.log(`[Server Action] CNAME lookup failed for ${domainToCheck}: ${err.message}`);
          
          // If CNAME lookup failed and we're specifically looking for CNAME records,
          // check for A records as a fallback to provide better information to user
          if (requestedTypes.includes('CNAME') && !requestedTypes.includes('A')) {
            console.log(`[Server Action] Checking A records as fallback for ${domainToCheck}`);
            try {
              const primaryServer = DNS_SERVERS[0];
              const fallbackARecords = await querySingleServer(domainToCheck, 'A', primaryServer, 3000);
              fallbackARecords.forEach(record => {
                records.push({ ...record, type: 'A (fallback for www)' });
              });
              console.log(`[Server Action] Found A records for ${domainToCheck} instead of CNAME`);
            } catch (fallbackErr) {
              console.log(`[Server Action] A record fallback also failed for ${domainToCheck}: ${fallbackErr.message}`);
            }
          }
        }
      }
      
      // Look up SOA records
      if (requestedTypes.length === 0 || requestedTypes.includes('SOA')) {
        try {
          const primaryServer = DNS_SERVERS[0];
          const soaRecords = await querySingleServer(cleanedDomain, 'SOA', primaryServer, 3000);
          soaRecords.forEach(record => {
            // Parse SOA record format for better display
            const parts = record.data.split(' ');
            if (parts.length >= 7) {
              const nsname = parts[0];
              const hostmaster = parts[1];
              const serial = parts[2];
              const formattedData = `${nsname} ${hostmaster} (Serial: ${serial})`;
              records.push({ ...record, data: formattedData, type: 'SOA' });
            } else {
              records.push({ ...record, type: 'SOA' });
            }
          });
        } catch (error) {
          console.log(`[Server Action] No SOA records found for ${cleanedDomain}`);
        }
      }
      
      // Look up CAA records (Certificate Authority Authorization)
      if (requestedTypes.length === 0 || requestedTypes.includes('CAA')) {
        try {
          const primaryServer = DNS_SERVERS[0];
          const caaRecords = await querySingleServer(cleanedDomain, 'CAA', primaryServer, 3000);
          caaRecords.forEach(record => {
            // Parse CAA record format: flags tag "value"
            const parts = record.data.split(' ');
            if (parts.length >= 3) {
              const flags = parseInt(parts[0]);
              const tag = parts[1];
              const value = parts.slice(2).join(' ').replace(/"/g, '');
              const critical = flags & 128 ? ' (critical)' : '';
              const formattedData = `${tag}: ${value}${critical}`;
              records.push({ ...record, data: formattedData, type: 'CAA' });
            } else {
              records.push({ ...record, type: 'CAA' });
            }
          });
        } catch (error) {
          console.log(`[Server Action] No CAA records found for ${cleanedDomain}`);
        }
      }

      // Email-specific records - check these separately since many domains don't have them
      
      // Check for SPF record (Sender Policy Framework) - part of TXT records
      // We already fetched TXT records, so just filter and categorize them
      const spfRecords = records
        .filter(record => record.type === 'TXT' && record.data.toLowerCase().startsWith('v=spf1'))
        .map(record => ({ ...record, type: 'SPF' }));
      
      // If we found SPF records, add them separately
      // Only add if all record types requested or SPF specifically requested
      if (requestedTypes.length === 0 || requestedTypes.includes('SPF')) {
        spfRecords.forEach(record => records.push(record));
      }
      
      // Check for DMARC record - specific TXT record at _dmarc subdomain
      if (requestedTypes.length === 0 || requestedTypes.includes('DMARC')) {
        try {
          const primaryServer = DNS_SERVERS[0];
          const dmarcRecords = await querySingleServer(`_dmarc.${cleanedDomain}`, 'TXT', primaryServer, 3000);
          dmarcRecords.forEach(record => {
            records.push({ ...record, type: 'DMARC' });
          });
        } catch (error) {
          console.log(`[Server Action] No DMARC records found for ${cleanedDomain}`);
        }
      }
      
      // Check for common DKIM selectors (many organizations use 'default', 'google', 'selector1', 'selector2')
      if (requestedTypes.length === 0 || requestedTypes.includes('DKIM')) {
        const commonSelectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'dkim'];
        
        for (const selector of commonSelectors) {
          try {
            const primaryServer = DNS_SERVERS[0];
            const dkimRecords = await querySingleServer(`${selector}._domainkey.${cleanedDomain}`, 'TXT', primaryServer, 3000);
            dkimRecords.forEach(record => {
              records.push({ 
                ...record, 
                type: 'DKIM',
                data: `${selector}: ${record.data}`
              });
            });
          } catch (err) {
            // Ignore errors for missing DKIM selectors - this is normal
            console.log(`[Server Action] No DKIM record found for selector ${selector}`);
          }
        }
      }
      
      console.log(`[Server Action] Found ${records.length} DNS records for ${cleanedDomain}`);
      
      // Filter records based on requested types if needed
      let filteredRecords = records;
      if (requestedTypes.length > 0) {
        filteredRecords = records.filter(record => requestedTypes.includes(record.type));
        console.log(`[Server Action] Filtered to ${filteredRecords.length} records based on requested types`);
      }
      
      if (filteredRecords.length === 0) {
        return fail(404, { error: `No DNS records found for ${cleanedDomain}` });
      }
      
      // Track any special messages to show to the user
      const messages: string[] = [];
      
      // If user specifically asked for CNAME but we found A records for www instead
      if (requestedTypes.includes('CNAME') && 
          filteredRecords.some(r => r.type === 'A (www)') && 
          !filteredRecords.some(r => r.type === 'CNAME')) {
        const wwwDomain = hasWww ? inputDomain : `www.${cleanedDomain}`;
        messages.push(`No CNAME records found for ${wwwDomain}. However, we found A records for this subdomain instead. This means the www subdomain is configured with direct IP addresses rather than as an alias (CNAME).`);
      }
      
      return {
        records: filteredRecords,
        domain: cleanedDomain,
        messages: messages.length > 0 ? messages : undefined
      };
    } catch (e: any) {
      console.error('[Server Action] Error during DNS lookup:', e.message);
      return fail(500, { error: e.message }); 
    }
  }
};
