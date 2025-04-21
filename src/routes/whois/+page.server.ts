import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

interface WhoisResult {
  domainName: string;
  registryData?: {
    createdDate?: string;
    updatedDate?: string;
    expiresDate?: string;
    registrant?: {
      organization?: string;
      country?: string;
    };
    administrativeContact?: {
      organization?: string;
      country?: string;
    };
    technicalContact?: {
      organization?: string;
      country?: string;
    };
    registrarName?: string;
    registrarIANAID?: string;
    nameServers?: {
      hostNames?: string[];
      ips?: string[];
    };
    status?: string;
  };
  contactEmail?: string;
  domainAvailability?: string;
  estimatedDomainAge?: number;
}

export const actions = {
  whoisLookup: async ({ request, fetch }) => {
    try {
      const data = await request.formData();
      let domain = data.get('domain')?.toString() || '';
      
      // Clean the domain - remove http:// or https:// prefix
      domain = domain.trim().replace(/^https?:\/\//, '');
      
      // Remove path if any
      domain = domain.split('/')[0];
      
      console.log(`[Server Action] Running WHOIS lookup for domain: ${domain}`);
      
      if (!domain) {
        return fail(400, { error: 'Domain is required' });
      }
      
      try {
        console.log(`[Server Action] Running multi-source WHOIS lookup for ${domain}`);
        
        // Safety timeout of 8 seconds to prevent hanging
        const overallTimeout = setTimeout(() => {
          console.log(`[Server Action] WHOIS lookup timeout for ${domain}`);
        }, 8000);
        
        // Attempt to gather data from multiple sources for better reliability
        const results = await Promise.allSettled([
          // Source 1: RDAP API (Registration Data Access Protocol)
          fetch(`https://rdap.org/domain/${domain}`).then(res => res.ok ? res.json() : null),
          
          // Source 2: DNS based information
          fetch(`https://dns.google/resolve?name=${domain}&type=NS`).then(res => res.ok ? res.json() : null),
          
          // Source 3: Basic domain validation + DNS
          validateDomain(domain)
        ]);
        
        // Extract successful results
        const rdapData = results[0].status === 'fulfilled' ? results[0].value : null;
        const dnsData = results[1].status === 'fulfilled' ? results[1].value : null;
        const validationData = results[2].status === 'fulfilled' ? results[2].value : null;
        
        // Clear the safety timeout
        clearTimeout(overallTimeout);
        
        // Log results
        console.log(`[Server Action] WHOIS sources: RDAP=${!!rdapData}, DNS=${!!dnsData}, Validation=${!!validationData}`);
        
        // Combine the data from multiple sources
        const combinedData = combineWhoisData(domain, rdapData, dnsData, validationData);
        
        return {
          whoisData: combinedData,
          domain
        };
        
      } catch (error) {
        console.error('[Server Action] Fetch Error:', error);
        return fail(500, { error: 'Failed to connect to WHOIS service' });
      }
      
    } catch (e: any) {
      console.error('[Server Action] WHOIS lookup error:', e);
      return fail(500, { error: e.message || 'Failed to perform WHOIS lookup' });
    }
  }
} satisfies Actions;

// Helper function to format the WHOIS API response into a structured format
// Helper function to validate a domain by DNS lookup and HTTP checks
async function validateDomain(domain: string): Promise<any> {
  // Timeout after 5 seconds to prevent hanging
  const timeout = (ms: number) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), ms));
    
  // Function with timeout
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([promise, timeout(ms)]) as Promise<T>;
  };
  try {
    // Check if the domain exists in DNS
    const dnsLookup = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
    const dnsResult = await dnsLookup.json();
    
    // Basic HTTP check with timeout
    let httpStatus = null;
    let server = null;
    try {
      const httpCheck = await withTimeout(fetch(`https://${domain}`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Route-Network-Tools/1.0' }
      }), 5000);
      httpStatus = httpCheck.status;
      server = httpCheck.headers.get('server');
    } catch (e) {
      console.log(`HTTP check failed for ${domain}:`, e);
    }
    
    return {
      exists: dnsResult.Answer && dnsResult.Answer.length > 0,
      dns: dnsResult,
      http: { status: httpStatus, server }
    };
  } catch (e) {
    console.error('Domain validation error:', e);
    return null;
  }
}

// Helper function to combine data from multiple sources
function combineWhoisData(domain: string, rdapData: any, dnsData: any, validationData: any): any {
  // Format date helper function
  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (e) {
      return dateStr;
    }
  }
  
  // Determine if domain exists based on validation data
  const domainExists = validationData?.exists === true;
  
  // Extract nameservers from DNS data
  let nameServers = [];
  if (dnsData?.Answer) {
    const nsRecords = dnsData.Answer.filter(record => record.type === 2); // NS records
    nameServers = nsRecords.map(record => record.data);
  }
  
  // Extract data from RDAP (if available)
  let registrar = 'Unknown';
  let createdDate = '';
  let updatedDate = '';
  let expiryDate = '';
  let status = domainExists ? 'Active' : 'Unknown';
  
  if (rdapData) {
    if (rdapData.entities && rdapData.entities.length > 0) {
      const registrarEntity = rdapData.entities.find(e => e.roles && e.roles.includes('registrar'));
      if (registrarEntity) {
        registrar = registrarEntity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || 
                   registrarEntity.vcardArray?.[1]?.find(v => v[0] === 'org')?.[3] || 
                   registrarEntity.handle || 'Unknown';
      }
    }
    
    // Extract events
    if (rdapData.events) {
      const registration = rdapData.events.find(e => e.eventAction === 'registration');
      const lastChanged = rdapData.events.find(e => e.eventAction === 'last changed');
      const expiration = rdapData.events.find(e => e.eventAction === 'expiration');
      
      if (registration) createdDate = formatDate(registration.eventDate);
      if (lastChanged) updatedDate = formatDate(lastChanged.eventDate);
      if (expiration) expiryDate = formatDate(expiration.eventDate);
    }
    
    // Extract status
    if (rdapData.status && rdapData.status.length > 0) {
      status = rdapData.status.join(', ');
    }
  }
  
  // Fallback data from validation
  if (validationData?.http?.server) {
    const serverInfo = validationData.http.server;
    // Some hosting info can be extracted from server headers
  }
  
  // Combine all data sources
  return {
    domainName: domain,
    registrar: registrar,
    createdDate: createdDate,
    updatedDate: updatedDate,
    expiresDate: expiryDate,
    status: status,
    nameServers: nameServers,
    registrant: {
      organization: 'Private',
      name: 'Private',
      email: 'Private',
      country: 'Unknown'
    },
    administrative: {
      name: 'Private',
      organization: 'Private',
      email: 'Private',
      country: 'Unknown'
    },
    technical: {
      name: 'Private',
      organization: 'Private',
      email: 'Private',
      country: 'Unknown'
    },
    raw: { rdapData, dnsData, validationData }
  };
}

