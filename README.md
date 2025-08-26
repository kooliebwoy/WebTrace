# WebTrace - DNS Lookup Tool

A modern DNS lookup and network diagnostic tool built with SvelteKit and Node.js.

## Features

- **Native DNS Resolution**: Uses Node.js built-in DNS module for fast, reliable DNS queries
- **Comprehensive Record Types**: A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SPF, DMARC, and DKIM records
- **DNS Propagation Checking**: Test DNS propagation across multiple global DNS servers
- **SSL Certificate Analysis**: Check SSL/TLS certificates and their validity
- **Domain Analysis**: WHOIS lookups and domain information
- **RPC Architecture**: Uses server-side RPC calls to backend workers instead of API endpoints

## DNS Implementation

This project uses Node.js native DNS resolution for optimal performance and reliability:

- **Native Performance**: Direct system DNS resolution without HTTP overhead
- **Full Feature Support**: Access to all DNS record types and advanced query options
- **System Integration**: Uses operating system's DNS resolver configuration
- **Robust Error Handling**: Comprehensive DNS error detection and reporting

The application leverages Node.js `dns.promises` module for all DNS operations with proper error handling and timeout management.

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

## Deployment

This application uses the Node.js adapter and can be deployed to any Node.js hosting environment.

### Production Server

After building, start the production server:

```bash
npm start
```

This runs `node build/index.js` to start the Node.js server.

### Environment Requirements

- Node.js 18+ (for native DNS module support)
- Network access for DNS queries and SSL certificate checks
- Sufficient memory for concurrent DNS operations

### Deployment Options

**Using PM2 (recommended for production):**

```bash
npm install -g pm2
pm2 start build/index.js --name "webtrace-dns-tool"
pm2 startup
pm2 save
```

**Using Docker:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build ./build
EXPOSE 3000
CMD ["node", "build/index.js"]
```

**Using systemd:**

Create `/etc/systemd/system/webtrace-dns.service`:

```ini
[Unit]
Description=WebTrace DNS Tool
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/webtrace
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Architecture Notes

- All DNS operations happen server-side for security and performance
- Native Node.js modules provide optimal DNS resolution performance
