/**
 * Native Node.js DNS helper
 * Uses the built-in Node.js dns module for DNS resolution
 */

import { promises as dns, Resolver } from 'node:dns';
import type { CaaRecord } from 'node:dns';
import { normalizeTxtRecord } from './txt-normalization';

export interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
  priority?: number;
}

export interface DNSResult {
  records: DNSRecord[];
  domain: string;
}

/**
 * Query DNS records using native Node.js dns module
 * @param domain Domain name to query
 * @param type DNS record type ('A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA')
 * @returns Promise<DNSRecord[]>
 */
export async function query(domain: string, type: string): Promise<DNSRecord[]> {
  const records: DNSRecord[] = [];
  
  try {
    switch (type.toUpperCase()) {
      case 'A': {
        const addresses = await dns.resolve4(domain);
        return addresses.map((address: string) => ({
          type: 'A',
          value: address
        }));
      }
      
      case 'AAAA': {
        const addresses = await dns.resolve6(domain);
        return addresses.map((address: string) => ({
          type: 'AAAA',
          value: address
        }));
      }
      
      case 'MX': {
        const mxRecords = await dns.resolveMx(domain);
        return mxRecords.map((record: { exchange: string; priority: number }) => ({
          type: 'MX',
          value: record.exchange,
          priority: record.priority
        }));
      }
      
      case 'TXT': {
        const txtRecords = await dns.resolveTxt(domain);
        return txtRecords.map((record: string[]) => ({
          type: 'TXT',
          value: normalizeTxtRecord(record)
        }));
      }
      
      case 'NS': {
        const nsRecords = await dns.resolveNs(domain);
        return nsRecords.map((ns: string) => ({
          type: 'NS',
          value: ns
        }));
      }
      
      case 'CNAME': {
        const cnameRecords = await dns.resolveCname(domain);
        return cnameRecords.map((cname: string) => ({
          type: 'CNAME',
          value: cname
        }));
      }
      
      case 'SOA': {
        const soaRecord = await dns.resolveSoa(domain);
        return [{
          type: 'SOA',
          value: `${soaRecord.nsname} ${soaRecord.hostmaster} (Serial: ${soaRecord.serial})`
        }];
      }
      
      case 'CAA': {
        const caaRecords = await dns.resolveCaa(domain);
        return caaRecords.map((record: CaaRecord) => {
          const tag = record.issue ? 'issue' : record.issuewild ? 'issuewild' : record.iodef ? 'iodef' : 'unknown';
          const value = record.issue ?? record.issuewild ?? record.iodef ?? '';
          const critical = record.critical && Number(record.critical) > 0 ? ' (critical)' : '';
          return {
            type: 'CAA',
            value: `${tag}: ${value}${critical}`
          };
        });
      }
      
      default:
        throw new Error(`Unsupported record type: ${type}`);
    }
  } catch (error) {
    // Handle DNS errors gracefully
    if (error instanceof Error) {
      // Common DNS error codes
      if (error.message.includes('ENOTFOUND') || error.message.includes('ENODATA')) {
        return []; // No records found, return empty array
      }
    }
    throw error;
  }
}

/**
 * Query multiple DNS record types for a domain
 * @param domain Domain name to query
 * @param types Array of DNS record types to query
 * @returns Promise<DNSRecord[]>
 */
export async function queryMultiple(domain: string, types: string[]): Promise<DNSRecord[]> {
  const allRecords: DNSRecord[] = [];
  
  for (const type of types) {
    try {
      const records = await query(domain, type);
      allRecords.push(...records);
    } catch (error) {
      console.log(`No ${type} records found for ${domain} or error:`, error);
      // Continue with other record types
    }
  }
  
  return allRecords;
}

/**
 * Query common DNS record types for a domain
 * @param domain Domain name to query
 * @returns Promise<DNSRecord[]>
 */
export async function queryAll(domain: string): Promise<DNSRecord[]> {
  const commonTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'];
  return queryMultiple(domain, commonTypes);
}

/**
 * Query special email-related records (SPF, DMARC, DKIM)
 * @param domain Domain name to query
 * @returns Promise<DNSRecord[]>
 */
export async function queryEmailRecords(domain: string): Promise<DNSRecord[]> {
  const records: DNSRecord[] = [];
  
  try {
    // Get TXT records and filter for SPF
    const txtRecords = await dns.resolveTxt(domain);
    const spfRecords = txtRecords
      .filter((record: string[]) => normalizeTxtRecord(record).toLowerCase().startsWith('v=spf1'))
      .map((record: string[]) => ({
        type: 'SPF',
        value: normalizeTxtRecord(record)
      }));
    records.push(...spfRecords);
  } catch (error) {
    console.log(`No SPF records found for ${domain}:`, error);
  }
  
  try {
    // Query DMARC records (_dmarc subdomain)
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    const dmarcFormatted = dmarcRecords.map((record: string[]) => ({
      type: 'DMARC',
      value: normalizeTxtRecord(record)
    }));
    records.push(...dmarcFormatted);
  } catch (error) {
    console.log(`No DMARC records found for ${domain}:`, error);
  }
  
  try {
    // Query DKIM records (common selectors)
    const commonSelectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'dkim'];
    for (const selector of commonSelectors) {
      try {
        const dkimRecords = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        const dkimFormatted = dkimRecords.map((record: string[]) => ({
          type: 'DKIM',
          value: `${selector}: ${normalizeTxtRecord(record)}`
        }));
        records.push(...dkimFormatted);
      } catch (error) {
        // No DKIM record for this selector, continue
      }
    }
  } catch (error) {
    console.log(`No DKIM records found for ${domain}:`, error);
  }
  
  return records;
}
