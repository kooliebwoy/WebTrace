// Mock implementations for Node.js modules in Cloudflare Workers
// These are only used during build time - at runtime, real modules are provided

// DNS module mock
export const dnsShim = {
  promises: {
    resolve4: async () => [],
    resolve6: async () => [],
    resolveMx: async () => [],
    resolveTxt: async () => [],
    resolveNs: async () => [],
    resolveSoa: async () => [],
    resolveCname: async () => [],
    resolveCaa: async () => [],
    resolveAny: async () => []
  },
  resolve: () => {},
  resolveTxt: () => {}
};

// TLS module mock
export const tlsShim = {
  connect: () => ({
    on: () => {},
    setTimeout: () => {},
    end: () => {},
    destroy: () => {},
    getPeerCertificate: () => ({})
  })
};

// NET module mock
export const netShim = {
  Socket: class {
    connect() {}
    on() {}
    setTimeout() {}
    end() {}
  }
};
