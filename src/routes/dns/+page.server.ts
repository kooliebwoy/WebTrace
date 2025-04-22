import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDnsModule, getTimers } from '$lib/server/node-compat';

export const actions: Actions = {
  dnsLookup: async ({ request }) => {
    console.log('[Server Action] dnsLookup started.');
    
    // Get DNS module safely using our compatibility helper
    const dns = await getDnsModule();

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
      
      // Get timers with compatible implementation
      const { setTimeout, clearTimeout } = await getTimers();

      // Helper function to safely run DNS lookups with timeout protection
      const safeDnsLookup = async (lookupFn: () => Promise<any>, recordType: string, formatFn?: Function) => {
        try {
          // Create a timeout ID reference outside the promise
          let timeoutId: any;

          // Create timeout protection for DNS lookups
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`DNS lookup timeout for ${recordType} records`));
            }, 3000); // 3 second timeout for DNS lookups
          });
          
          // Race the DNS lookup against the timeout
          const result = await Promise.race([
            lookupFn(),
            timeoutPromise
          ]);
          
          // Clear timeout if DNS lookup won
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          if (Array.isArray(result)) {
            result.forEach(record => {
              if (typeof record === 'string') {
                records.push({ type: recordType, data: record });
              } else if (typeof record === 'object') {
                // For complex records (like MX) that have additional fields
                const formattedData = formatFn ? formatFn(record) : JSON.stringify(record);
                records.push({ 
                  type: recordType, 
                  data: typeof formattedData === 'string' ? formattedData : JSON.stringify(formattedData),
                  ttl: record.ttl,
                  priority: record.priority
                });
              }
            });
          }
        } catch (error) {
          console.log(`[Server Action] No ${recordType} records found or error:`, error);
          // We don't fail here, just continue with other record types
        }
      };
      
      // Only perform lookups if no specific types requested or the specific type is requested
      
      // Look up A records (IPv4) for the main domain
      if (requestedTypes.length === 0 || requestedTypes.includes('A')) {
        await safeDnsLookup(
          () => dns.promises.resolve4(cleanedDomain, { ttl: true }),
          'A',
          (record: { address: string; ttl: number }) => record.address
        );
        
        // If the user is querying CNAME but not explicitly A records,
        // and we have a www domain or need to check www, check A records for the www subdomain too
        // since many sites implement www as direct A records instead of CNAMEs
        if (requestedTypes.includes('CNAME') && !requestedTypes.includes('A')) {
          const wwwDomain = hasWww ? inputDomain : `www.${cleanedDomain}`;
          await safeDnsLookup(
            () => dns.promises.resolve4(wwwDomain, { ttl: true }),
            'A (www)',
            (record: { address: string; ttl: number }) => record.address
          );
        }
      }
      
      // Look up AAAA records (IPv6)
      if (requestedTypes.length === 0 || requestedTypes.includes('AAAA')) {
        await safeDnsLookup(
          () => dns.promises.resolve6(cleanedDomain, { ttl: true }),
          'AAAA',
          (record: { address: string; ttl: number }) => record.address
        );
      }
      
      // Look up MX records
      if (requestedTypes.length === 0 || requestedTypes.includes('MX')) {
        await safeDnsLookup(
          () => dns.promises.resolveMx(cleanedDomain),
          'MX',
          (record: { exchange: string; priority: number }) => record.exchange
        );
      }
      
      // Look up TXT records - always fetch as they may contain SPF
      if (requestedTypes.length === 0 || requestedTypes.includes('TXT') || requestedTypes.includes('SPF')) {
        await safeDnsLookup(
          () => dns.promises.resolveTxt(cleanedDomain),
          'TXT',
          (record: string[]) => record.join(' ')
        );
      }
      
      // Look up NS records
      if (requestedTypes.length === 0 || requestedTypes.includes('NS')) {
        await safeDnsLookup(
          () => dns.promises.resolveNs(cleanedDomain),
          'NS'
        );
      }
      
      // Look up CNAME records
      if (requestedTypes.length === 0 || requestedTypes.includes('CNAME')) {
        // For www subdomains or www checks, we need to check both CNAME and A records
        // since some domains configure www with CNAME and others with direct A records
        const domainToCheck = hasWww ? inputDomain : `www.${cleanedDomain}`;
        
        console.log(`[Server Action] Looking up CNAME for: ${domainToCheck}`);
        
        // First try CNAME lookup
        let cnameFound = false;
        await safeDnsLookup(
          () => dns.promises.resolveCname(domainToCheck),
          'CNAME'
        ).then(() => {
          cnameFound = true;
          console.log(`[Server Action] CNAME records found for ${domainToCheck}`);
        }).catch(async err => {
          console.log(`[Server Action] CNAME lookup failed for ${domainToCheck}: ${err.message}`);
          
          // If CNAME lookup failed and we're specifically looking for CNAME records,
          // check for A records as a fallback to provide better information to user
          if (requestedTypes.includes('CNAME') && !requestedTypes.includes('A')) {
            console.log(`[Server Action] Checking A records as fallback for ${domainToCheck}`);
            await safeDnsLookup(
              () => dns.promises.resolve4(domainToCheck),
              'A (fallback for www)'
            ).then(result => {
              console.log(`[Server Action] Found A records for ${domainToCheck} instead of CNAME`);
            }).catch(err => {
              console.log(`[Server Action] A record fallback also failed for ${domainToCheck}: ${err.message}`);
            });
          }
        });
      }
      
      // Look up SOA records
      if (requestedTypes.length === 0 || requestedTypes.includes('SOA')) {
        await safeDnsLookup(
          () => dns.promises.resolveSoa(cleanedDomain),
          'SOA',
          (record: {
            nsname: string;
            hostmaster: string;
            serial: number;
            refresh: number;
            retry: number;
            expire: number;
            minttl: number;
          }) => `${record.nsname} ${record.hostmaster} (Serial: ${record.serial})`
        );
      }
      
      // Look up CAA records (Certificate Authority Authorization)
      if (requestedTypes.length === 0 || requestedTypes.includes('CAA')) {
        await safeDnsLookup(
          () => dns.promises.resolveCaa(cleanedDomain),
          'CAA',
          (record: { critical: boolean; tag: string; value: string }) => 
            `${record.tag}: ${record.value}${record.critical ? ' (critical)' : ''}`
        );
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
        await safeDnsLookup(
          () => dns.promises.resolveTxt(`_dmarc.${cleanedDomain}`),
          'DMARC',
          (record: string[]) => record.join(' ')
        );
      }
      
      // Check for common DKIM selectors (many organizations use 'default', 'google', 'selector1', 'selector2')
      if (requestedTypes.length === 0 || requestedTypes.includes('DKIM')) {
        const commonSelectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'dkim'];
        
        for (const selector of commonSelectors) {
          await safeDnsLookup(
            () => dns.promises.resolveTxt(`${selector}._domainkey.${cleanedDomain}`),
            'DKIM',
            (record: string[]) => `${selector}: ${record.join(' ')}`
          ).catch(err => {
            // Ignore errors for missing DKIM selectors - this is normal
            console.log(`[Server Action] No DKIM record found for selector ${selector}`);
          });
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
