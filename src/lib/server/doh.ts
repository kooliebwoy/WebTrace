/**
 * DNS-over-HTTPS (DoH) helper using Web-standard APIs
 * Works in both Cloudflare Workers and local Vite preview
 */

import { normalizeTxtRecord } from '$lib/server/txt-normalization';

export interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

export interface DoHResponse {
  Status: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  AD?: boolean;
  CD?: boolean;
  Question?: Array<{
    name: string;
    type: number;
  }>;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

export interface DoHResult {
  records: DNSRecord[];
  rcode: number;
  elapsed: number;
}

// DNS record type constants
const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257
} as const;

const REVERSE_DNS_TYPES = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  257: 'CAA'
} as const;

/**
 * Fetch-based DNS-over-HTTPS helper
 * @param serverUrl DoH server URL (e.g., 'https://cloudflare-dns.com/dns-query')
 * @param name Domain name to query
 * @param type DNS record type ('A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME')
 * @param timeoutMs Timeout in milliseconds (default: 2000)
 * @returns Promise<DoHResult>
 * @throws Error on network failure or non-NOERROR responses
 */
export async function dohQuery(
  serverUrl: string,
  name: string,
  type: string,
  timeoutMs: number = 2000
): Promise<DoHResult> {
  const startTime = Date.now();
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build query string
    const typeCode = DNS_RECORD_TYPES[type.toUpperCase() as keyof typeof DNS_RECORD_TYPES] || type;
    const queryParams = new URLSearchParams({
      name: name,
      type: typeCode.toString(),
      cd: 'true' // Checking Disabled flag
    });

    const url = `${serverUrl}?${queryParams.toString()}`;

    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/dns-json',
        'User-Agent': 'RouteKit-DoH/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DoHResponse = await response.json();
    const elapsed = Date.now() - startTime;

    // Check DNS response code (RCODE)
    if (data.Status !== 0) {
      throw new Error(`DNS query failed with RCODE ${data.Status}`);
    }

    // Map DoH response to DNSRecord format
    const records: DNSRecord[] = data.Answer 
      ? data.Answer.map(answer => {
          const recordType = REVERSE_DNS_TYPES[answer.type as keyof typeof REVERSE_DNS_TYPES] || `TYPE${answer.type}`;
          let recordValue = answer.data;
          
          // Normalize TXT records according to RFC 1035
          if (recordType === 'TXT') {
            recordValue = normalizeTxtRecord(answer.data);
          }
          
          return {
            type: recordType,
            value: recordValue,
            ttl: answer.TTL
          };
        })
      : [];

    return {
      records,
      rcode: data.Status,
      elapsed
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle AbortController timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`DNS query timed out after ${timeoutMs}ms`);
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: ${error.message}`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Multi-provider DoH query with automatic fallback
 * Uses Cloudflare as primary, Google as fallback
 */
export async function dohQueryWithFallback(
  name: string,
  type: string,
  timeoutMs: number = 2000
): Promise<DoHResult> {
  const providers = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve'
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      return await dohQuery(provider, name, type, timeoutMs);
    } catch (error) {
      lastError = error as Error;
      // Continue to next provider
    }
  }

  // All providers failed
  throw lastError || new Error('All DoH providers failed');
}
