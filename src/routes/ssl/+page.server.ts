import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getTlsModule, getNetModule } from '$lib/server/node-compat';

// Define the SSL certificate result structure
interface Certificate {
  subject: { CN: string };
  issuer: { CN: string, O?: string };
  subjectaltname?: string;
  valid_from: string;
  valid_to: string;
  fingerprint: string;
  serialNumber: string;
  version: number;
  ext_key_usage?: string[];
}

export const actions = {
  sslCheck: async ({ request }) => {
    try {
      const data = await request.formData();
      let domain = data.get('domain')?.toString() || '';
      
      // Clean the domain - remove http:// or https:// prefix
      domain = domain.trim().replace(/^https?:\/\//, '');
      
      // Remove path if any
      domain = domain.split('/')[0];
      
      // Default port for HTTPS
      const port = 443;
      
      console.log(`[Server Action] Checking SSL for domain: ${domain}`);
      
      if (!domain) {
        return fail(400, { error: 'Domain is required' });
      }
      
      // Fetch the SSL certificate
      const certInfo = await getCertificate(domain, port);
      
      if (!certInfo) {
        return fail(404, { error: `Unable to fetch SSL certificate for ${domain}` });
      }
      
      console.log(`[Server Action] Successfully fetched SSL certificate for ${domain}`);
      
      // Format alternative names for better readability
      let altNames: string[] = [];
      if (certInfo.subjectaltname) {
        // Parse the DNS names from the SAN field
        altNames = certInfo.subjectaltname
          .split(',')
          .map(name => name.trim())
          .filter(name => name.startsWith('DNS:'))
          .map(name => name.substring(4));
      }
      
      // Calculate days until expiration
      const now = new Date();
      const expiryDate = new Date(certInfo.valid_to);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine certificate status
      let status = 'valid';
      if (daysUntilExpiry <= 0) {
        status = 'expired';
      } else if (daysUntilExpiry <= 30) {
        status = 'warning';
      }
      
      return {
        domain,
        certificate: {
          ...certInfo,
          altNames,
          daysUntilExpiry,
          status,
          formattedExpiryDate: formatDate(expiryDate),
          formattedIssueDate: formatDate(new Date(certInfo.valid_from))
        }
      };
    } catch (e: any) {
      console.error('[Server Action] SSL check error:', e);
      return fail(500, { error: e.message || 'Failed to check SSL certificate' });
    }
  }
} satisfies Actions;

// Helper function to get SSL certificate
async function getCertificate(domain: string, port: number): Promise<Certificate> {
  // Get modules safely using our compatibility helper
  const tls = await getTlsModule();
  const net = await getNetModule();
  
  return new Promise((resolve, reject) => {
    let isClosed = false;
    let tlsSocket: any;
    
    // Set connection timeout - 10 seconds
    const timeout = setTimeout(() => {
      if (!isClosed) {
        isClosed = true;
        if (tlsSocket) tlsSocket.destroy();
        reject(new Error(`Connection to ${domain}:${port} timed out`));
      }
    }, 10000);
    
    try {
      // Using tls.connect with the dynamically imported module
      tlsSocket = tls.connect({
        host: domain,
        port: port,
        servername: domain,
        rejectUnauthorized: false  // Allow self-signed certificates
      }, () => {
        clearTimeout(timeout);
        
        const cert = tlsSocket.getPeerCertificate(true);
        tlsSocket.end();
        
        if (Object.keys(cert).length > 0) {
          resolve(cert as unknown as Certificate);
        } else {
          reject(new Error('No certificate information available'));
        }
      });
      
      tlsSocket.on('error', (err) => {
        clearTimeout(timeout);
        if (!isClosed) {
          isClosed = true;
          reject(err);
        }
      });
      
      // Set a reasonable timeout for the socket
      tlsSocket.setTimeout(10000);
      tlsSocket.on('timeout', () => {
        if (!isClosed) {
          isClosed = true;
          tlsSocket.destroy();
          reject(new Error(`Connection to ${domain}:${port} timed out`));
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Helper function to format dates nicely
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return date.toLocaleDateString('en-US', options);
}
