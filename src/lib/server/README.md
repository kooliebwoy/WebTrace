# DNS-over-HTTPS (DoH) Module Tests

This directory contains comprehensive unit tests for the DNS-over-HTTPS functionality using `vitest`.

## Test Coverage

### `doh.test.ts`
Tests for the main DoH query functions with stubbed `fetch` calls:

#### ✅ Successful Answer Parsing
- **A records**: IPv4 address parsing
- **AAAA records**: IPv6 address parsing  
- **MX records**: Mail exchange records
- **TXT records**: Text records with normalization
- **CNAME records**: Canonical name records
- **NS records**: Name server records
- **CAA records**: Certificate Authority Authorization
- **Unknown record types**: Graceful handling with `TYPE{number}` format
- **Empty responses**: No answer section handling
- **Multiple records**: Multiple answers in single response

#### ⏱️ Timeout Behavior
- **Custom timeouts**: Specified timeout periods
- **Default timeout**: 2000ms default behavior
- **Timeout cleanup**: Proper cleanup on successful completion

#### 🚨 Error Propagation
- **NXDOMAIN (RCODE 3)**: Domain not found errors
- **SERVFAIL (RCODE 2)**: Server failure errors
- **REFUSED (RCODE 5)**: Query refused errors
- **HTTP errors**: 404, 500, and other HTTP status codes
- **Network errors**: Connection failures and fetch errors
- **JSON parsing**: Malformed response handling
- **Custom errors**: Re-throwing of unexpected errors

#### 🔄 Fallback Provider Testing
- **Primary provider success**: Cloudflare DNS usage
- **Provider failover**: Fallback to Google DNS
- **Complete failure**: All providers failing
- **Timeout passing**: Timeout parameters passed through

### `txt-normalization.test.ts`
Tests for TXT record normalization per RFC 1035:

#### 📝 Text Normalization
- **String inputs**: Direct string handling
- **Array inputs**: Multi-part string joining
- **Empty values**: Edge case handling
- **Complex records**: SPF, DMARC, and other structured TXT records
- **Equivalence checking**: Comparing different representations

## Running Tests

```bash
# Run tests once
npm run test:run

# Run tests in watch mode  
npm run test

# Run tests with UI
npm run test:ui
```

## Test Architecture

- **Mocked Dependencies**: `fetch` is stubbed for predictable testing
- **AbortController Support**: Timeout handling in Node.js environment
- **Comprehensive Coverage**: All record types, error conditions, and edge cases
- **Fast Execution**: Runs without real network calls

## Benefits

- **Rapid Local Iteration**: Test changes without running the full Svelte app
- **Reliable CI/CD**: Consistent test results without external dependencies
- **Comprehensive Validation**: All DNS record types and error scenarios covered
- **Performance Testing**: Timeout and network error simulation
