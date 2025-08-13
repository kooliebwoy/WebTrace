/**
 * This module provides runtime-safe imports for Node.js modules
 * that are only available in the Cloudflare Workers environment.
 * 
 * Note: DNS functionality has been migrated to DNS-over-HTTPS (DoH) implementation
 * in src/lib/server/doh.ts for better compatibility and performance.
 */

// Empty shims for build time
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

/**
 * Safely get Timers functions, with fallbacks
 */
export async function getTimers() {
  try {
    const timers = await import('node:timers');
    return {
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    };
  } catch (e) {
    console.log('Using timers fallback for build');
    // Use global setTimeout/clearTimeout as fallback
    return {
      setTimeout: globalThis.setTimeout || ((...args) => args[2]),
      clearTimeout: globalThis.clearTimeout || (() => {})
    };
  }
}
