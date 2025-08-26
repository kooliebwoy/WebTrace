/**
 * Vitest setup file
 * Global test configuration and mocks
 */

import { vi, afterEach } from 'vitest';

// Mock Node.js DNS module for testing
vi.mock('node:dns', () => ({
  promises: {
    resolve4: vi.fn().mockResolvedValue(['1.2.3.4']),
    resolve6: vi.fn().mockResolvedValue(['2001:db8::1']),
    resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]),
    resolveTxt: vi.fn().mockResolvedValue([['v=spf1 include:_spf.google.com ~all']]),
    resolveNs: vi.fn().mockResolvedValue(['ns1.example.com', 'ns2.example.com']),
    resolveCname: vi.fn().mockResolvedValue(['canonical.example.com']),
    resolveSoa: vi.fn().mockResolvedValue({
      nsname: 'ns1.example.com',
      hostmaster: 'admin.example.com',
      serial: 2024010101
    }),
    resolveCaa: vi.fn().mockResolvedValue([{ tag: 'issue', value: 'letsencrypt.org' }])
  }
}));

// Mock Node.js TLS module for SSL certificate testing
vi.mock('node:tls', () => ({
  connect: vi.fn().mockImplementation((options, callback) => {
    const mockSocket = {
      getPeerCertificate: vi.fn().mockReturnValue({
        subject: { CN: 'example.com' },
        issuer: { CN: 'Test CA', O: 'Test Organization' },
        valid_from: 'Jan 1 00:00:00 2024 GMT',
        valid_to: 'Jan 1 00:00:00 2025 GMT',
        fingerprint: 'AA:BB:CC:DD:EE:FF',
        serialNumber: '123456789',
        version: 3
      }),
      end: vi.fn(),
      setTimeout: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn()
    };
    
    if (callback) {
      setTimeout(() => callback(), 10);
    }
    
    return mockSocket;
  })
}));

// Mock Node.js timers module
vi.mock('node:timers', () => ({
  setTimeout: vi.fn().mockImplementation((fn, delay) => globalThis.setTimeout(fn, delay)),
  clearTimeout: vi.fn().mockImplementation((id) => globalThis.clearTimeout(id))
}));

// Setup AbortController and related APIs for Node.js environment
if (!globalThis.AbortController) {
  const { AbortController, AbortSignal } = await import('abort-controller');
  // Cast to any to satisfy DOM lib types expected by the code under test
  globalThis.AbortController = AbortController as any;
  globalThis.AbortSignal = AbortSignal as any;
}

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});
