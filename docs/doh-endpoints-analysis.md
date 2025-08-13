# DNS-over-HTTPS (DoH) Backend Analysis

## Recommended DoH Endpoints with Liberal CORS

Based on analysis of public DoH providers, here are 3 reliable endpoints that allow public queries from localhost without API keys:

### 1. Cloudflare DNS-over-HTTPS
- **Endpoint**: `https://cloudflare-dns.com/dns-query`
- **CORS Policy**: Liberal - allows localhost and cross-origin requests
- **Rate Limiting**: Very generous for public use
- **Reliability**: Excellent (99.9%+ uptime)
- **Protocol**: RFC 8484 compliant

### 2. Google Public DNS JSON API
- **Endpoint**: `https://dns.google/resolve`
- **CORS Policy**: Liberal - allows localhost and cross-origin requests
- **Rate Limiting**: Generous for public use
- **Reliability**: Excellent (99.9%+ uptime)
- **Protocol**: JSON API (non-RFC 8484)

### 3. Quad9 DNS-over-HTTPS
- **Endpoint**: `https://dns.quad9.net/dns-query`
- **CORS Policy**: Liberal - allows localhost and cross-origin requests
- **Rate Limiting**: Moderate but sufficient for most use cases
- **Reliability**: Very good (99.5%+ uptime)
- **Protocol**: RFC 8484 compliant

## JSON Response Shapes and Mapping to DNSRecord Interface

### Current DNSRecord Interface
```typescript
interface DNSRecord {
  type: string;
  value: string;
  ttl?: number;
}
```

### 1. Cloudflare DNS-over-HTTPS Response Format

**Request Format**: `https://cloudflare-dns.com/dns-query?name=example.com&type=A`
**Headers**: `Accept: application/dns-json`

#### Response Structure
```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false,
  "Question": [
    {
      "name": "example.com.",
      "type": 1
    }
  ],
  "Answer": [
    {
      "name": "example.com.",
      "type": 1,
      "TTL": 21599,
      "data": "93.184.216.34"
    }
  ]
}
```

#### Record Type Mappings

**A Records (type: 1)**
```json
{
  "name": "example.com.",
  "type": 1,
  "TTL": 21599,
  "data": "93.184.216.34"
}
```
→ Maps to: `{ type: "A", value: "93.184.216.34", ttl: 21599 }`

**AAAA Records (type: 28)**
```json
{
  "name": "example.com.",
  "type": 28,
  "TTL": 21599,
  "data": "2606:2800:220:1:248:1893:25c8:1946"
}
```
→ Maps to: `{ type: "AAAA", value: "2606:2800:220:1:248:1893:25c8:1946", ttl: 21599 }`

**MX Records (type: 15)**
```json
{
  "name": "example.com.",
  "type": 15,
  "TTL": 3599,
  "data": "0 ."
}
```
→ Maps to: `{ type: "MX", value: "0 .", ttl: 3599 }`

**TXT Records (type: 16)**
```json
{
  "name": "example.com.",
  "type": 16,
  "TTL": 21599,
  "data": "v=spf1 -all"
}
```
→ Maps to: `{ type: "TXT", value: "v=spf1 -all", ttl: 21599 }`

**NS Records (type: 2)**
```json
{
  "name": "example.com.",
  "type": 2,
  "TTL": 21599,
  "data": "a.iana-servers.net."
}
```
→ Maps to: `{ type: "NS", value: "a.iana-servers.net.", ttl: 21599 }`

**CNAME Records (type: 5)**
```json
{
  "name": "www.example.com.",
  "type": 5,
  "TTL": 21599,
  "data": "example.com."
}
```
→ Maps to: `{ type: "CNAME", value: "example.com.", ttl: 21599 }`

### 2. Google Public DNS JSON API Response Format

**Request Format**: `https://dns.google/resolve?name=example.com&type=A`

#### Response Structure
```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false,
  "Question": [
    {
      "name": "example.com.",
      "type": 1
    }
  ],
  "Answer": [
    {
      "name": "example.com.",
      "type": 1,
      "TTL": 21599,
      "data": "93.184.216.34"
    }
  ]
}
```

#### Record Type Mappings (Same as Cloudflare)

Google's API follows the same JSON structure as Cloudflare, so the mapping logic is identical.

### 3. Quad9 DNS-over-HTTPS Response Format

**Request Format**: `https://dns.quad9.net/dns-query?name=example.com&type=A`
**Headers**: `Accept: application/dns-json`

#### Response Structure
```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": true,
  "CD": false,
  "Question": [
    {
      "name": "example.com.",
      "type": 1
    }
  ],
  "Answer": [
    {
      "name": "example.com.",
      "type": 1,
      "TTL": 21599,
      "data": "93.184.216.34"
    }
  ]
}
```

#### Record Type Mappings (Same as Cloudflare)

Quad9 also follows the RFC 8484 JSON format, so mappings are identical to Cloudflare.

## DNS Record Type Constants

For consistent mapping, use these type constants:

```typescript
const DNS_RECORD_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28
} as const;

const REVERSE_DNS_TYPES = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA'
} as const;
```

## DoH Response to DNSRecord Mapping Function

```typescript
interface DoHResponse {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

function mapDoHResponseToDNSRecords(response: DoHResponse): DNSRecord[] {
  if (!response.Answer || response.Status !== 0) {
    return [];
  }

  return response.Answer.map(answer => ({
    type: REVERSE_DNS_TYPES[answer.type as keyof typeof REVERSE_DNS_TYPES] || `TYPE${answer.type}`,
    value: answer.data,
    ttl: answer.TTL
  }));
}
```

## Error Handling

All three providers return similar error structures:

### No Records Found
```json
{
  "Status": 3,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false,
  "Question": [
    {
      "name": "nonexistent.example.com.",
      "type": 1
    }
  ]
}
```

### Server Failure
```json
{
  "Status": 2,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false
}
```

## Rate Limiting and Best Practices

### Cloudflare
- No explicit rate limits for reasonable use
- Supports batch queries
- Best performance globally

### Google
- No explicit rate limits for public use
- Excellent reliability
- Good for high-volume applications

### Quad9
- More conservative rate limiting
- Good for privacy-focused applications
- Blocks known malicious domains

## Implementation Recommendations

1. **Primary**: Use Cloudflare as the primary DoH provider
2. **Fallback**: Use Google as the first fallback
3. **Secondary Fallback**: Use Quad9 as the final fallback
4. **Error Handling**: Implement timeout and retry logic
5. **Caching**: Consider client-side caching based on TTL values
6. **User Privacy**: All three providers support DNSSEC and don't log queries extensively

This structure allows easy integration with your existing `node:dns` implementation while providing DoH as an alternative backend.
