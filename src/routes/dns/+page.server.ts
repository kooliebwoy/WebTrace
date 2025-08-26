import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { query, queryEmailRecords } from '$lib/server/dns';

// Helper function to safely perform DNS lookups with consistent return format
async function safeDnsLookup(
  domain: string,
  recordType: string
): Promise<{type: string; data: string; ttl?: number; priority?: number}[]> {
  try {
    const records = await query(domain, recordType);
    return records.map(record => ({
      type: record.type,
      data: record.value,
      ttl: record.ttl,
      priority: record.priority
    }));
  } catch (error) {
    console.log(`[Server Action] DNS lookup failed for ${recordType} records on ${domain}:`, error);
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
    
    // Clean the domain: remove protocol and path
    let cleanedDomain = domain.trim()
      .replace(/^https?:\/\//i, '') // Remove protocol
      .replace(/^www\./i, '') // Remove www prefix
      .split('/')[0]; // Remove path
    
    console.log(`[Server Action] Cleaned domain: ${cleanedDomain}`);
    
    try {
      const allRecords: Array<{type: string; data: string; ttl?: number; priority?: number}> = [];
      
      // If no specific record types requested, get all common types
      const typesToQuery = requestedTypes.length > 0 ? requestedTypes : 
        ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'];
      
      // Query standard DNS records
      for (const type of typesToQuery) {
        if (['SPF', 'DMARC', 'DKIM'].includes(type)) {
          continue; // Handle these separately
        }
        
        const records = await safeDnsLookup(cleanedDomain, type);
        allRecords.push(...records);
      }
      
      // Query email-specific records if requested or if querying all
      if (requestedTypes.length === 0 || 
          requestedTypes.some(type => ['SPF', 'DMARC', 'DKIM'].includes(type))) {
        try {
          const emailRecords = await queryEmailRecords(cleanedDomain);
          const emailRecordsFormatted = emailRecords.map(record => ({
            type: record.type,
            data: record.value,
            ttl: record.ttl,
            priority: record.priority
          }));
          allRecords.push(...emailRecordsFormatted);
        } catch (error) {
          console.log(`[Server Action] Failed to query email records:`, error);
        }
      }
      
      // Extract SPF records from TXT records for separate categorization
      if (requestedTypes.length === 0 || requestedTypes.includes('SPF')) {
        const spfRecords = allRecords
          .filter(record => record.type === 'TXT' && record.data.toLowerCase().startsWith('v=spf1'))
          .map(record => ({ ...record, type: 'SPF' }));
        allRecords.push(...spfRecords);
      }
      
      console.log(`[Server Action] Found ${allRecords.length} DNS records for ${cleanedDomain}`);
      
      // Filter records based on requested types if needed
      let filteredRecords = allRecords;
      if (requestedTypes.length > 0) {
        filteredRecords = allRecords.filter(record => requestedTypes.includes(record.type));
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
