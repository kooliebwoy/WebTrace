# WebTrace - DNS Lookup Tool

A modern DNS lookup and network diagnostic tool built with SvelteKit and Node.js.

## Features

- **Native DNS Resolution**: Uses Node.js built-in DNS module for fast, reliable DNS queries
- **Comprehensive Record Types**: A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SPF, DMARC, and DKIM records
- **DNS Propagation Checking**: Test DNS propagation across multiple global DNS servers
- **SSL Certificate Analysis**: Check SSL/TLS certificates and their validity
- **Domain Analysis**: WHOIS lookups and domain information

## DNS Implementation

This project uses Node.js native DNS resolution for optimal performance and reliability:

- **Native Performance**: Direct system DNS resolution without HTTP overhead
- **Full Feature Support**: Access to all DNS record types and advanced query options
- **System Integration**: Uses operating system's DNS resolver configuration
- **Robust Error Handling**: Comprehensive DNS error detection and reporting

The application leverages Node.js `dns.promises` module for all DNS operations with proper error handling and timeout management.

### Architecture Notes

- All DNS operations happen server-side for security and performance
- Nothing is stored on the client side or at all since it's a one-time operation
