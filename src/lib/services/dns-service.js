/**
 * DNS Service - Handles all DNS lookup functionality
 * Uses runtime checks to load appropriate modules
 */

// Runtime detection for environment
const isCloudflareWorker = typeof caches !== 'undefined';

// Main DNS lookup function used by all components
export async function dnsLookup(domain, recordType) {
  try {
    // In Cloudflare Workers environment with nodejs_compat
    if (isCloudflareWorker) {
      // Will only execute this import at runtime in Cloudflare Workers
      const dns = await import('node:dns');
      return await performDnsLookup(dns, domain, recordType);
    } else {
      // During build or in other environments, this code path is taken
      console.warn('DNS lookup not available in this environment');
      return [];
    }
  } catch (error) {
    console.error('DNS lookup error:', error);
    throw error;
  }
}

// Helper functions that use the dynamically imported DNS module
async function performDnsLookup(dns, domain, recordType) {
  const promises = dns.promises;
  
  switch (recordType) {
    case 'A':
      return await promises.resolve4(domain);
    case 'AAAA':
      return await promises.resolve6(domain);
    case 'MX':
      return await promises.resolveMx(domain);
    case 'TXT':
      return await promises.resolveTxt(domain);
    case 'NS':
      return await promises.resolveNs(domain);
    case 'CNAME':
      return await promises.resolveCname(domain);
    case 'SOA':
      return await promises.resolveSoa(domain);
    case 'CAA':
      return await promises.resolveCaa(domain);
    default:
      throw new Error(`Unsupported record type: ${recordType}`);
  }
}
