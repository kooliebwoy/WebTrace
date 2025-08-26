/**
 * DNS-over-HTTPS (DoH) client for Node/SvelteKit (adapter-node)
 *
 * Supports common JSON DoH endpoints:
 *  - Cloudflare: https://cloudflare-dns.com/dns-query?name=example.com&type=TXT
 *  - Cloudflare (Mozilla): https://mozilla.cloudflare-dns.com/dns-query?name=example.com&type=TXT
 *  - Google: https://dns.google/resolve?name=example.com&type=TXT
 *  - AliDNS: https://dns.alidns.com/resolve?name=example.com&type=TXT
 *  - DNS.SB: https://doh.sb/dns-query?name=example.com&type=TXT
 *  - NextDNS: https://dns.nextdns.io/dns-query?name=example.com&type=TXT
 *
 * Returns a normalized structure compatible with the propagation module.
 */

import { normalizeTxtRecord } from './txt-normalization';

export interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}

export interface DoHResult {
  records: DNSRecord[];
  elapsed: number;
}

// Map RR numeric type codes to string names (subset)
const TYPE_MAP: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA'
};

function rrToString(type: number): string {
  return TYPE_MAP[type] ?? String(type);
}

function normalizeRecord(rrtype: string, data: any): DNSRecord | null {
  // TXT records often come quoted or as joined strings already in DoH JSON
  if (rrtype === 'TXT') {
    // data may be quoted string like "\"v=spf1 ...\"" or multiple chunks joined
    const normalized = normalizeTxtRecord(String(data));
    return { type: 'TXT', value: normalized };
  }

  if (rrtype === 'MX') {
    // Some JSON providers return just the exchange in Answer.data (priority encoded elsewhere).
    // In JSON DoH, MX usually appears as "priority exchange" e.g. "10 mail.example.com.".
    const str = String(data);
    return { type: 'MX', value: str };
  }

  if (rrtype === 'CAA') {
    // Usually like: "0 issue \"letsencrypt.org\""
    return { type: 'CAA', value: String(data) };
  }

  // Default: return as is
  return { type: rrtype, value: String(data) };
}

/**
 * Perform a DoH query with timeout using common JSON formats.
 */
export async function dohQuery(baseUrl: string, domain: string, recordType: string, timeoutMs = 3000): Promise<DoHResult> {
  const start = Date.now();

  // Determine parameter shape: Google uses /resolve with name/type; Cloudflare and others accept /dns-query with name/type
  const url = new URL(baseUrl);
  const type = recordType.toUpperCase();

  // Clear existing search params to avoid duplicates
  url.searchParams.delete('name');
  url.searchParams.delete('type');

  // Both formats accept name/type in query for JSON responses
  url.searchParams.set('name', domain);
  url.searchParams.set('type', type);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // Cloudflare/others return JSON when requesting this Accept header
        'Accept': 'application/dns-json, application/json;q=0.9, */*;q=0.8'
      },
      signal: controller.signal
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      throw new Error(`DoH HTTP ${res.status}`);
    }

    // Expect a JSON body with an Answer array per RFC8484 JSON profiles used by Google/Cloudflare
    // Some providers may return application/json with fields: { Status, Answer: [{ name, type, TTL, data }] }
    const body = await res.json().catch(() => ({}));

    const answers: Array<{ name: string; type: number; TTL?: number; data: string }>
      = Array.isArray(body?.Answer) ? body.Answer : [];

    const records: DNSRecord[] = [];

    for (const ans of answers) {
      const rr = rrToString(ans.type);
      if (rr !== type) {
        // Some resolvers include CNAME/A chains; only include requested type
        if (type !== 'TXT' || rr !== 'TXT') continue;
      }
      const rec = normalizeRecord(rr, ans.data);
      if (rec) {
        if (typeof ans.TTL === 'number') rec.ttl = ans.TTL;
        records.push(rec);
      }
    }

    return { records, elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    if ((err as any)?.name === 'AbortError') {
      throw new Error(`DoH timed out after ${timeoutMs}ms`);
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(id);
  }
}
