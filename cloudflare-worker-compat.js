/**
 * This file provides mock implementations for Node.js modules
 * that are used at runtime in Cloudflare Workers but not available during build
 */

export const mockModules = {
  // Mock implementation for node:dns
  'node:dns': `
    export default {
      promises: {
        resolve4: async () => [],
        resolve6: async () => [],
        resolveTxt: async () => [],
        resolveMx: async () => [],
        resolveNs: async () => [],
        resolveCname: async () => [],
        resolveSoa: async () => [],
        resolveCaa: async () => [],
        resolveAny: async () => []
      },
      resolveTxt: () => {},
      resolve4: () => {},
      resolve: () => {}
    };
  `,

  // Mock implementation for node:tls
  'node:tls': `
    export const connect = () => ({
      on: () => {},
      setTimeout: () => {},
      end: () => {},
      destroy: () => {},
      getPeerCertificate: () => ({})
    });
    export default { connect };
  `,

  // Mock implementation for node:net
  'node:net': `
    export default {
      Socket: class Socket {
        connect() {}
        on() {}
        setTimeout() {}
        end() {}
      }
    };
  `
};

/**
 * Create a Vite plugin to mock Node.js modules during build
 */
export function createCloudflareCompatPlugin() {
  return {
    name: 'cloudflare-node-compat',
    resolveId(id) {
      if (mockModules[id]) {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0virtual:')) {
        const moduleId = id.slice('\0virtual:'.length);
        if (mockModules[moduleId]) {
          console.log(`[CloudflareCompat] Providing mock for ${moduleId}`);
          return mockModules[moduleId];
        }
      }
      return null;
    }
  };
}
