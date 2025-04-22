import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
  dnsLookup: async ({ request }) => {
    console.log('[Server Action] dnsLookup started.');
    
    // Dynamically import dns module at runtime
    const dns = await import('node:dns');

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
    
    // Clean the domain (remove any http, https, www if present)
    let cleanedDomain = domain.trim()
      .replace(/^https?:\/\//i, '')  // Remove http:// or https://
      .replace(/^www\./i, '');       // Remove www.
    
    try {
      
      // Initialize array to store all DNS records
      const records: Array<{type: string; data: string; ttl?: number; priority?: number}> = [];
      
      // Helper function to safely run DNS lookups
      const safeDnsLookup = async (lookupFn: () => Promise<any>, recordType: string, formatFn?: Function) => {
        try {
          const result = await lookupFn();
          
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
      
      // Look up A records (IPv4)
      if (requestedTypes.length === 0 || requestedTypes.includes('A')) {
        await safeDnsLookup(
          () => dns.promises.resolve4(cleanedDomain, { ttl: true }),
          'A',
          (record: { address: string; ttl: number }) => record.address
        );
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
        await safeDnsLookup(
          () => dns.promises.resolveCname(cleanedDomain),
          'CNAME'
        );
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
            () => dns.resolveTxt(`${selector}._domainkey.${cleanedDomain}`),
            'DKIM',
            (record: string[]) => `${selector}: ${record.join(' ')}`
          );
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
      
      return {
        records: filteredRecords,
        domain: cleanedDomain
      };
    } catch (e: any) {
      console.error('[Server Action] Error during DNS lookup:', e.message);
      return fail(500, { error: e.message }); 
    }
  }
};
