/**
 * This module provides runtime-safe imports for Node.js modules
 * that are only available in the Cloudflare Workers environment.
 */

// Empty shims for build time
const dnsShim = { 
  promises: {
    resolve4: async () => [],
    resolve6: async () => [],
    resolveTxt: async () => [],
    resolveMx: async () => [],
    resolveNs: async () => [],
    resolveCname: async () => [],
    resolveSoa: async () => [],
    resolveCaa: async () => []
  }
};

const tlsShim = {
  connect: () => ({
    on: () => {},
    setTimeout: () => {},
    end: () => {},
    destroy: () => {},
    getPeerCertificate: () => ({})
  })
};

const netShim = {};

/**
 * Safely get DNS module, either from runtime or a shim
 */
export async function getDnsModule() {
  try {
    // This will only succeed at runtime in the Cloudflare Workers environment
    // During build time, it will throw and return the shim
    return await import('node:dns');
  } catch (e) {
    console.log('Using DNS shim for build');
    return dnsShim;
  }
}

/**
 * Safely get TLS module, either from runtime or a shim
 */
export async function getTlsModule() {
  try {
    return await import('node:tls');
  } catch (e) {
    console.log('Using TLS shim for build');
    return tlsShim;
  }
}

/**
 * Safely get NET module, either from runtime or a shim
 */
export async function getNetModule() {
  try {
    return await import('node:net');
  } catch (e) {
    console.log('Using NET shim for build');
    return netShim;
  }
}
