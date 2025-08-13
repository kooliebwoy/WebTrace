import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getDnsModule } from '$lib/server/node-compat';
import { promisify } from 'util';
import { normalizeTxtRecord } from '$lib/server/txt-normalization';

// SPF Validation Result Interface
interface SPFResult {
  domain: string;
  records: {
    raw: string[];
    parsed: ParsedSPFRecord[];
  };
  isValid: boolean;
  hasSyntaxErrors: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

interface ParsedSPFRecord {
  type: string;
  value: string;
  description: string;
  category: 'ip' | 'domain' | 'mechanism' | 'modifier' | 'unknown';
  isValid: boolean;
}

export const actions = {
  spfCheck: async ({ request, fetch }) => {
    try {
      const data = await request.formData();
      let domain = data.get('domain')?.toString() || '';
      
      // Clean the domain - remove http:// or https:// prefix
      domain = domain.trim().replace(/^https?:\/\//, '');
      
      // Remove path if any
      domain = domain.split('/')[0];
      
      if (!domain) {
        return fail(400, { error: 'Please enter a valid domain' });
      }
      
      console.log(`[Server Action] Running SPF check for domain: ${domain}`);
      
      // Fetch SPF records
      const spfResult = await checkSPFRecords(domain);
      
      return {
        spfResult,
        success: true
      };
      
    } catch (error) {
      console.error('Error in SPF check:', error);
      return fail(500, { 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }
};

// Function to check SPF records for a domain
async function checkSPFRecords(domain: string): Promise<SPFResult> {
  // Get DNS module safely using our compatibility helper
  const dns = await getDnsModule();
  const resolveTxt = promisify(dns.resolveTxt);
  
  const result: SPFResult = {
    domain,
    records: {
      raw: [],
      parsed: []
    },
    isValid: false,
    hasSyntaxErrors: false,
    hasWarnings: false,
    errors: [],
    warnings: [],
    score: 0
  };

  try {
    // Fetch TXT records
    const txtRecords = await resolveTxt(domain);
    
    // Filter for SPF records
    const spfRecords = txtRecords.filter(record => {
      const recordStr = normalizeTxtRecord(record);
      return recordStr.toLowerCase().startsWith('v=spf1');
    });

    if (spfRecords.length === 0) {
      result.errors.push('No SPF record found');
      result.hasSyntaxErrors = true;
      return result;
    }

    if (spfRecords.length > 1) {
      result.warnings.push('Multiple SPF records found. Only one SPF record should be defined.');
      result.hasWarnings = true;
    }

    // Store raw records
    result.records.raw = spfRecords.map(rec => normalizeTxtRecord(rec));
    
    // Parse the first SPF record (the standard says only one should be processed)
    const mainRecord = normalizeTxtRecord(spfRecords[0]);
    result.records.parsed = parseSPFRecord(mainRecord);
    
    // Check for syntax errors
    checkSPFSyntax(mainRecord, result);
    
    // Validate mechanisms and modifiers
    validateMechanisms(result);
    
    // Calculate score
    calculateSPFScore(result);
    
    return result;
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND')) {
        result.errors.push(`Domain ${domain} not found`);
      } else if (error.message.includes('ENODATA') || error.message.includes('queryTxt ENODATA')) {
        result.errors.push(`No DNS TXT records found for ${domain}`);
      } else {
        result.errors.push(`Error: ${error.message}`);
      }
    } else {
      result.errors.push('An unknown error occurred');
    }
    
    result.hasSyntaxErrors = true;
    return result;
  }
}

// Function to parse an SPF record
function parseSPFRecord(record: string): ParsedSPFRecord[] {
  const parsed: ParsedSPFRecord[] = [];
  const parts = record.split(' ');
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    // Version tag
    if (part.toLowerCase().startsWith('v=spf1')) {
      parsed.push({
        type: 'version',
        value: part,
        description: 'SPF version 1',
        category: 'mechanism',
        isValid: true
      });
      continue;
    }
    
    // Handle qualifiers
    let qualifier = '';
    let mechanism = part;
    
    if (part.startsWith('+') || part.startsWith('-') || part.startsWith('?') || part.startsWith('~')) {
      qualifier = part[0];
      mechanism = part.substring(1);
    }
    
    // IP4 mechanism
    if (mechanism.startsWith('ip4:')) {
      const ip = mechanism.substring(4);
      parsed.push({
        type: 'ip4',
        value: part,
        description: `IPv4 address or range: ${ip}`,
        category: 'ip',
        isValid: validateIPv4(ip)
      });
    }
    // IP6 mechanism
    else if (mechanism.startsWith('ip6:')) {
      const ip = mechanism.substring(4);
      parsed.push({
        type: 'ip6',
        value: part,
        description: `IPv6 address or range: ${ip}`,
        category: 'ip',
        isValid: validateIPv6(ip)
      });
    }
    // A mechanism
    else if (mechanism === 'a' || mechanism.startsWith('a:')) {
      const domain = mechanism === 'a' ? '' : mechanism.substring(2);
      parsed.push({
        type: 'a',
        value: part,
        description: domain ? `Address records for domain: ${domain}` : 'Address records for current domain',
        category: 'domain',
        isValid: true
      });
    }
    // MX mechanism
    else if (mechanism === 'mx' || mechanism.startsWith('mx:')) {
      const domain = mechanism === 'mx' ? '' : mechanism.substring(3);
      parsed.push({
        type: 'mx',
        value: part,
        description: domain ? `Mail exchange records for domain: ${domain}` : 'Mail exchange records for current domain',
        category: 'domain',
        isValid: true
      });
    }
    // Include mechanism
    else if (mechanism.startsWith('include:')) {
      const domain = mechanism.substring(8);
      parsed.push({
        type: 'include',
        value: part,
        description: `Include SPF record of domain: ${domain}`,
        category: 'domain',
        isValid: domain.length > 0
      });
    }
    // Exists mechanism
    else if (mechanism.startsWith('exists:')) {
      const domain = mechanism.substring(7);
      parsed.push({
        type: 'exists',
        value: part,
        description: `Check if domain exists: ${domain}`,
        category: 'domain',
        isValid: domain.length > 0
      });
    }
    // Redirect modifier
    else if (mechanism.startsWith('redirect=')) {
      const domain = mechanism.substring(9);
      parsed.push({
        type: 'redirect',
        value: part,
        description: `Redirect to SPF record of domain: ${domain}`,
        category: 'modifier',
        isValid: domain.length > 0
      });
    }
    // Exp modifier
    else if (mechanism.startsWith('exp=')) {
      const domain = mechanism.substring(4);
      parsed.push({
        type: 'exp',
        value: part,
        description: `Explanation from domain: ${domain}`,
        category: 'modifier',
        isValid: domain.length > 0
      });
    }
    // All mechanism
    else if (mechanism === 'all') {
      let description = 'Match all other hosts';
      
      if (qualifier === '+') description = 'Allow all other hosts (not recommended)';
      if (qualifier === '-') description = 'Deny all other hosts (recommended)';
      if (qualifier === '~') description = 'Soft fail for all other hosts (common)';
      if (qualifier === '?') description = 'Neutral for all other hosts (not recommended)';
      
      parsed.push({
        type: 'all',
        value: part,
        description,
        category: 'mechanism',
        isValid: true
      });
    }
    // Unknown mechanism
    else {
      parsed.push({
        type: 'unknown',
        value: part,
        description: `Unknown or invalid mechanism: ${part}`,
        category: 'unknown',
        isValid: false
      });
    }
  }
  
  return parsed;
}

// Function to validate IPv4 addresses (simple validation)
function validateIPv4(ip: string): boolean {
  // Basic validation for CIDR notation
  const [address, cidr] = ip.split('/');
  
  // Validate the IPv4 address with regex
  const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipv4Pattern.test(address)) return false;
  
  // If CIDR is specified, validate it
  if (cidr) {
    const cidrNum = parseInt(cidr, 10);
    if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) return false;
  }
  
  return true;
}

// Function to validate IPv6 addresses (simple validation)
function validateIPv6(ip: string): boolean {
  // Basic validation for CIDR notation
  const [address, cidr] = ip.split('/');
  
  // Very simple regex for IPv6 - not fully comprehensive
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){0,6}::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;
  if (!ipv6Pattern.test(address)) return false;
  
  // If CIDR is specified, validate it
  if (cidr) {
    const cidrNum = parseInt(cidr, 10);
    if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 128) return false;
  }
  
  return true;
}

// Function to check SPF syntax
function checkSPFSyntax(record: string, result: SPFResult): void {
  // Check if record starts with v=spf1
  if (!record.toLowerCase().startsWith('v=spf1')) {
    result.errors.push('SPF record must start with "v=spf1"');
    result.hasSyntaxErrors = true;
  }
  
  // Check for multiple all mechanisms
  const allCount = record.match(/\s+all|\s+\+all|\s+\-all|\s+\?all|\s+\~all/g)?.length || 0;
  if (allCount > 1) {
    result.errors.push('Multiple "all" mechanisms found. Only one "all" mechanism should be used.');
    result.hasSyntaxErrors = true;
  }
  
  // Check if all mechanism is the last one
  const parts = record.split(' ').filter(p => p.trim());
  const allIndex = parts.findIndex(p => 
    p === 'all' || p === '+all' || p === '-all' || p === '?all' || p === '~all'
  );
  
  if (allIndex !== -1 && allIndex !== parts.length - 1) {
    result.warnings.push('"all" mechanism should be the last mechanism in the record');
    result.hasWarnings = true;
  }
  
  // Check for multiple redirect modifiers
  const redirectCount = record.match(/\sredirect=/g)?.length || 0;
  if (redirectCount > 1) {
    result.errors.push('Multiple "redirect=" modifiers found. Only one redirect modifier should be used.');
    result.hasSyntaxErrors = true;
  }
  
  // Check for invalid qualifier combinations
  if (record.includes('?all') && !record.includes('~all') && !record.includes('-all')) {
    result.warnings.push('Neutral qualifier "?all" without more specific qualifiers may lead to excessive spam');
    result.hasWarnings = true;
  }
  
  // Check if the record is too long (per RFC, should not exceed 450 characters)
  if (record.length > 450) {
    result.warnings.push('SPF record exceeds 450 characters, which may cause issues with some DNS providers');
    result.hasWarnings = true;
  }
}

// Function to validate SPF mechanisms
function validateMechanisms(result: SPFResult): void {
  // Check for presence of important mechanisms
  let hasAll = false;
  let hasMx = false;
  let hasIpMechanisms = false;
  
  for (const item of result.records.parsed) {
    if (item.type === 'all') {
      hasAll = true;
      
      // Check for +all (allow all) which is a security risk
      if (item.value === '+all' || item.value === 'all') {
        result.warnings.push('Using "+all" allows any server to send mail as your domain, which is a security risk');
        result.hasWarnings = true;
      }
    }
    
    if (item.type === 'mx') {
      hasMx = true;
    }
    
    if (item.type === 'ip4' || item.type === 'ip6') {
      hasIpMechanisms = true;
      
      // Check for invalid IP entries
      if (!item.isValid) {
        result.errors.push(`Invalid IP address format in mechanism: ${item.value}`);
        result.hasSyntaxErrors = true;
      }
    }
    
    if (!item.isValid) {
      result.errors.push(`Invalid mechanism or syntax: ${item.value}`);
      result.hasSyntaxErrors = true;
    }
  }
  
  // Add warning if no "all" mechanism is present
  if (!hasAll) {
    result.warnings.push('No "all" mechanism found. It is recommended to include an "all" mechanism as the last element.');
    result.hasWarnings = true;
  }
  
  // Add warning if no IP or MX mechanisms
  if (!hasIpMechanisms && !hasMx) {
    result.warnings.push('No IP or MX mechanisms found. Consider adding specific authorized senders.');
    result.hasWarnings = true;
  }
}

// Function to calculate SPF score
function calculateSPFScore(result: SPFResult): void {
  let score = 100;
  
  // Reduce score for errors
  score -= result.errors.length * 20;
  
  // Reduce score for warnings
  score -= result.warnings.length * 10;
  
  // Check for critical security issues
  const hasAllowAll = result.records.parsed.some(item => 
    item.type === 'all' && (item.value === '+all' || item.value === 'all')
  );
  
  if (hasAllowAll) {
    score -= 30;
  }
  
  // Check for recommended practices
  const hasDenyAll = result.records.parsed.some(item => 
    item.type === 'all' && item.value === '-all'
  );
  
  if (hasDenyAll) {
    score += 10;
  }
  
  // Set validity flag
  result.isValid = result.errors.length === 0;
  
  // Cap score between 0 and 100
  result.score = Math.max(0, Math.min(100, score));
}
