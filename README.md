# Route - DNS Lookup Tool

A modern DNS lookup and network diagnostic tool built with SvelteKit and Cloudflare Workers.

## Features

- **DNS-over-HTTPS (DoH)**: Uses secure, modern DNS resolution instead of traditional DNS queries
- **Multiple DNS Providers**: Supports Cloudflare, Google, and Quad9 DoH endpoints
- **Comprehensive Record Types**: A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SPF, DMARC, and DKIM records
- **DNS Propagation Checking**: Test DNS propagation across multiple global DNS servers
- **SSL Certificate Analysis**: Check SSL/TLS certificates and their validity
- **Domain Analysis**: WHOIS lookups and domain information

## DNS-over-HTTPS Implementation

This project uses DNS-over-HTTPS (DoH) for DNS resolution instead of traditional Node.js DNS modules. This approach provides:

- **Better Security**: All DNS queries are encrypted via HTTPS
- **Universal Compatibility**: Works in both Cloudflare Workers and local development
- **Reliable Fallback**: Multiple DoH providers ensure high availability
- **No Node.js Dependencies**: Pure web-standard APIs for maximum portability

### DNS Endpoints Used

The application uses the following DoH endpoints in order of preference:

1. **Cloudflare DNS** (Primary)
   - Endpoint: `https://cloudflare-dns.com/dns-query`
   - Features: Excellent global performance, liberal CORS policy
   - Reliability: 99.9%+ uptime

2. **Google Public DNS** (Fallback)
   - Endpoint: `https://dns.google/resolve`
   - Features: JSON API format, generous rate limits
   - Reliability: 99.9%+ uptime

3. **Quad9 DNS** (Secondary Fallback)
   - Endpoint: `https://dns.quad9.net/dns-query`
   - Features: Privacy-focused, blocks malicious domains
   - Reliability: 99.5%+ uptime

All endpoints support RFC 8484 compliant DoH queries with automatic fallback mechanisms.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
