/**
 * Unit tests for DNS-over-HTTPS (DoH) functionality
 * Tests cover successful parsing, timeouts, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dohQuery, dohQueryWithFallback } from './doh.js';
import type { DoHResponse } from './doh.js';

// Mock the txt-normalization module
vi.mock('./txt-normalization.js', () => ({
  normalizeTxtRecord: vi.fn((value: string | string[]) => 
    Array.isArray(value) ? value.join('') : value
  )
}));

describe('dohQuery', () => {
  const mockServerUrl = 'https://cloudflare-dns.com/dns-query';
  const mockDomain = 'example.com';

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset fetch mock
    vi.mocked(fetch).mockClear();
  });

  describe('Successful DNS queries for different record types', () => {
    it('should successfully parse A record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        TC: false,
        RD: true,
        RA: true,
        AD: false,
        CD: false,
        Question: [{ name: 'example.com.', type: 1 }],
        Answer: [
          {
            name: 'example.com.',
            type: 1,
            TTL: 300,
            data: '93.184.216.34'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'A');

      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        type: 'A',
        value: '93.184.216.34',
        ttl: 300
      });
      expect(result.rcode).toBe(0);
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should successfully parse AAAA record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 28,
            TTL: 300,
            data: '2606:2800:220:1:248:1893:25c8:1946'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'AAAA');

      expect(result.records[0]).toEqual({
        type: 'AAAA',
        value: '2606:2800:220:1:248:1893:25c8:1946',
        ttl: 300
      });
    });

    it('should successfully parse MX record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 15,
            TTL: 3600,
            data: '10 mail.example.com.'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'MX');

      expect(result.records[0]).toEqual({
        type: 'MX',
        value: '10 mail.example.com.',
        ttl: 3600
      });
    });

    it('should successfully parse TXT record response with normalization', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 16,
            TTL: 300,
            data: 'v=spf1 include:_spf.example.com ~all'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'TXT');

      expect(result.records[0]).toEqual({
        type: 'TXT',
        value: 'v=spf1 include:_spf.example.com ~all',
        ttl: 300
      });
    });

    it('should successfully parse CNAME record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'www.example.com.',
            type: 5,
            TTL: 300,
            data: 'example.com.'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, 'www.example.com', 'CNAME');

      expect(result.records[0]).toEqual({
        type: 'CNAME',
        value: 'example.com.',
        ttl: 300
      });
    });

    it('should successfully parse NS record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 2,
            TTL: 86400,
            data: 'ns1.example.com.'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'NS');

      expect(result.records[0]).toEqual({
        type: 'NS',
        value: 'ns1.example.com.',
        ttl: 86400
      });
    });

    it('should successfully parse CAA record response', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 257,
            TTL: 300,
            data: '0 issue "letsencrypt.org"'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'CAA');

      expect(result.records[0]).toEqual({
        type: 'CAA',
        value: '0 issue "letsencrypt.org"',
        ttl: 300
      });
    });

    it('should handle unknown record types gracefully', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 999, // Unknown type
            TTL: 300,
            data: 'unknown data'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'UNKNOWN');

      expect(result.records[0]).toEqual({
        type: 'TYPE999',
        value: 'unknown data',
        ttl: 300
      });
    });

    it('should handle empty answer section', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: undefined
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'A');

      expect(result.records).toEqual([]);
      expect(result.rcode).toBe(0);
    });

    it('should handle multiple records in answer section', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 1,
            TTL: 300,
            data: '93.184.216.34'
          },
          {
            name: 'example.com.',
            type: 1,
            TTL: 300,
            data: '93.184.216.35'
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const result = await dohQuery(mockServerUrl, mockDomain, 'A');

      expect(result.records).toHaveLength(2);
      expect(result.records[0].value).toBe('93.184.216.34');
      expect(result.records[1].value).toBe('93.184.216.35');
    });
  });

  describe('Timeout behavior', () => {
    it('should timeout after specified timeout period', async () => {
      // Mock fetch to reject with AbortError after delay
      vi.mocked(fetch).mockImplementationOnce(
        () => {
          return new Promise((_, reject) => {
            setTimeout(() => {
              const abortError = new Error('AbortError');
              abortError.name = 'AbortError';
              reject(abortError);
            }, 50);
          });
        }
      );

      const timeoutMs = 100;
      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A', timeoutMs)
      ).rejects.toThrow(`DNS query timed out after ${timeoutMs}ms`);
    });

    it('should use default timeout of 2000ms when not specified', async () => {
      // Mock fetch to reject with AbortError
      vi.mocked(fetch).mockImplementationOnce(
        () => {
          return new Promise((_, reject) => {
            setTimeout(() => {
              const abortError = new Error('AbortError');
              abortError.name = 'AbortError';
              reject(abortError);
            }, 50);
          });
        }
      );

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('DNS query timed out after 2000ms');
    });

    it('should clear timeout when request completes successfully', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com.',
            type: 1,
            TTL: 300,
            data: '93.184.216.34'
          }
        ]
      };

      // Simulate a slow but successful response
      vi.mocked(fetch).mockResolvedValueOnce(
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          } as Response), 50)
        )
      );

      const result = await dohQuery(mockServerUrl, mockDomain, 'A', 1000);
      
      expect(result.records).toHaveLength(1);
      expect(result.elapsed).toBeGreaterThanOrEqual(50);
      expect(result.elapsed).toBeLessThanOrEqual(100);
    });
  });

  describe('Error propagation', () => {
    it('should throw error for NXDOMAIN (rcode 3)', async () => {
      const mockResponse: DoHResponse = {
        Status: 3, // NXDOMAIN
        Answer: undefined
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await expect(
        dohQuery(mockServerUrl, 'nonexistent.example.com', 'A')
      ).rejects.toThrow('DNS query failed with RCODE 3');
    });

    it('should throw error for SERVFAIL (rcode 2)', async () => {
      const mockResponse: DoHResponse = {
        Status: 2, // SERVFAIL
        Answer: undefined
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('DNS query failed with RCODE 2');
    });

    it('should throw error for REFUSED (rcode 5)', async () => {
      const mockResponse: DoHResponse = {
        Status: 5, // REFUSED
        Answer: undefined
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('DNS query failed with RCODE 5');
    });

    it('should throw error for HTTP 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should throw error for HTTP 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new TypeError('fetch failed')
      );

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('Network error: fetch failed');
    });

    it('should handle JSON parsing errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Invalid JSON'))
      } as Response);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('Invalid JSON');
    });

    it('should re-throw other types of errors', async () => {
      const customError = new Error('Custom error');
      vi.mocked(fetch).mockRejectedValueOnce(customError);

      await expect(
        dohQuery(mockServerUrl, mockDomain, 'A')
      ).rejects.toThrow('Custom error');
    });
  });

  describe('Request parameters', () => {
    it('should construct correct query URL and headers', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: []
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await dohQuery(mockServerUrl, mockDomain, 'A');

      expect(fetch).toHaveBeenCalledWith(
        'https://cloudflare-dns.com/dns-query?name=example.com&type=1&cd=true',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'application/dns-json',
            'User-Agent': 'RouteKit-DoH/1.0'
          },
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should handle case-insensitive record types', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: []
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await dohQuery(mockServerUrl, mockDomain, 'aaaa');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=28'),
        expect.any(Object)
      );
    });

    it('should handle numeric record types', async () => {
      const mockResponse: DoHResponse = {
        Status: 0,
        Answer: []
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      await dohQuery(mockServerUrl, mockDomain, '999');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=999'),
        expect.any(Object)
      );
    });
  });
});

describe('dohQueryWithFallback', () => {
  const mockDomain = 'example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockClear();
  });

  it('should use primary provider (Cloudflare) when available', async () => {
    const mockResponse: DoHResponse = {
      Status: 0,
      Answer: [
        {
          name: 'example.com.',
          type: 1,
          TTL: 300,
          data: '93.184.216.34'
        }
      ]
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    const result = await dohQueryWithFallback(mockDomain, 'A');

    expect(result.records).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cloudflare-dns.com'),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should fallback to secondary provider (Google) when primary fails', async () => {
    const mockResponse: DoHResponse = {
      Status: 0,
      Answer: [
        {
          name: 'example.com.',
          type: 1,
          TTL: 300,
          data: '93.184.216.34'
        }
      ]
    };

    // First call (Cloudflare) fails
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    
    // Second call (Google) succeeds
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    const result = await dohQueryWithFallback(mockDomain, 'A');

    expect(result.records).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, 
      expect.stringContaining('cloudflare-dns.com'),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenNthCalledWith(2,
      expect.stringContaining('dns.google'),
      expect.any(Object)
    );
  });

  it('should throw error when all providers fail', async () => {
    const networkError = new Error('Network failure');
    
    // Both providers fail
    vi.mocked(fetch).mockRejectedValueOnce(networkError);
    vi.mocked(fetch).mockRejectedValueOnce(networkError);

    await expect(
      dohQueryWithFallback(mockDomain, 'A')
    ).rejects.toThrow('Network failure');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should pass through timeout parameter to underlying queries', async () => {
    const mockResponse: DoHResponse = {
      Status: 0,
      Answer: []
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);

    await dohQueryWithFallback(mockDomain, 'A', 5000);

    // Should have been called with AbortSignal that would timeout after 5000ms
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });
});
