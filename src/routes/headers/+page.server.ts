import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getTimers } from '$lib/server/node-compat';

export const actions = {
  headersCheck: async ({ request, fetch }) => {
    try {
      const data = await request.formData();
      let url = data.get('url')?.toString() || '';
      
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      console.log(`[Server Action] Checking headers for URL: ${url}`);
      
      if (!url) {
        return fail(400, { error: 'URL is required' });
      }
      
      try {
        // Get timers with compatible implementation
        const { setTimeout, clearTimeout } = await getTimers();
        
        // Implement manual timeout mechanism
        let isTimedOut = false;
        const controller = new AbortController();
        
        // Create a timeout promise with even shorter timeout
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            isTimedOut = true;
            controller.abort();
            reject(new Error('Request timed out after 5 seconds'));
          }, 5000); // Even shorter timeout for Cloudflare Workers
        });
        
        // Create the fetch promise with more optimization
        const fetchPromise = fetch(url, {
          method: 'HEAD', // Try HEAD first
          headers: {
            'User-Agent': 'WebTrace-Network-Tools/1.0',
            'Accept': '*/*',
            'Connection': 'close', // Close connection after request
            'Cache-Control': 'no-cache' // Bypass caches
          },
          redirect: 'manual', // Don't follow redirects automatically
          signal: controller.signal
        }).catch(error => {
          // If HEAD request fails, try GET as fallback with limited response
          if (!isTimedOut) {
            console.log('HEAD request failed, trying GET as fallback');
            return fetch(url, {
              method: 'GET',
              headers: {
                'User-Agent': 'WebTrace-Network-Tools/1.0',
                'Accept': '*/*',
                'Connection': 'close', // Close connection after request
                'Cache-Control': 'no-cache' // Bypass caches
              },
              redirect: 'manual',
              signal: controller.signal
            });
          }
          throw error;
        });
        
        // Race the fetch against the timeout with additional error recovery
        let response: Response;
        try {
          response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
          
          // Clear the timeout if the fetch won the race
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          // Verify response is valid
          if (!response || !response.headers) {
            throw new Error('Invalid response received');
          }
        } catch (error: unknown) {
          // Additional error logging and recovery
          console.error(`Headers check failed for ${url}:`, error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          const name = error instanceof Error ? error.name : '';
          return fail(500, { 
            error: name === 'AbortError' 
              ? 'Request timed out - the server took too long to respond'
              : `Request failed: ${message}` 
          });
        }
        
        // Get all headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        // Categorize headers
        const securityHeaders = {
          'Content-Security-Policy': headers['content-security-policy'],
          'Strict-Transport-Security': headers['strict-transport-security'],
          'X-Content-Type-Options': headers['x-content-type-options'],
          'X-Frame-Options': headers['x-frame-options'],
          'X-XSS-Protection': headers['x-xss-protection'],
          'Referrer-Policy': headers['referrer-policy']
        };
        
        const cacheHeaders = {
          'Cache-Control': headers['cache-control'],
          'Expires': headers['expires'],
          'Last-Modified': headers['last-modified'],
          'ETag': headers['etag']
        };
        
        const corsHeaders = {
          'Access-Control-Allow-Origin': headers['access-control-allow-origin'],
          'Access-Control-Allow-Methods': headers['access-control-allow-methods'],
          'Access-Control-Allow-Headers': headers['access-control-allow-headers'],
          'Access-Control-Max-Age': headers['access-control-max-age']
        };
        
        const serverHeaders = {
          'Server': headers['server'],
          'X-Powered-By': headers['x-powered-by'],
          'Via': headers['via']
        };
        
        const contentHeaders = {
          'Content-Type': headers['content-type'],
          'Content-Length': headers['content-length'],
          'Content-Encoding': headers['content-encoding'],
          'Content-Language': headers['content-language']
        };
        
        // Calculate security score
        const securityScore = calculateSecurityScore(headers);
        
        // Return processed headers
        return {
          url,
          statusCode: response.status,
          statusText: response.statusText,
          allHeaders: headers,
          categorizedHeaders: {
            security: securityHeaders,
            cache: cacheHeaders,
            cors: corsHeaders,
            server: serverHeaders,
            content: contentHeaders
          },
          securityScore
        };
        
      } catch (error: unknown) {
        console.error('[Server Action] Fetch error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const name = error instanceof Error ? error.name : '';
        return fail(500, { 
          error: name === 'AbortError' 
            ? 'Request timed out' 
            : `Failed to fetch headers: ${message}` 
        });
      }
      
    } catch (e: unknown) {
      console.error('[Server Action] Headers check error:', e);
      const message = e instanceof Error ? e.message : 'Failed to check headers';
      return fail(500, { error: message });
    }
  }
} satisfies Actions;

// Helper function to calculate security score based on headers
function calculateSecurityScore(headers: Record<string, string>): { score: number; max: number; category: string } {
  let score = 0;
  const maxScore = 100;
  
  // Check for Content-Security-Policy
  if (headers['content-security-policy']) {
    score += 20;
  }
  
  // Check for Strict-Transport-Security
  if (headers['strict-transport-security']) {
    score += 20;
  }
  
  // Check for X-Content-Type-Options
  if (headers['x-content-type-options']?.includes('nosniff')) {
    score += 15;
  }
  
  // Check for X-Frame-Options
  if (headers['x-frame-options']) {
    score += 15;
  }
  
  // Check for X-XSS-Protection
  if (headers['x-xss-protection']) {
    score += 15;
  }
  
  // Check for Referrer-Policy
  if (headers['referrer-policy']) {
    score += 15;
  }
  
  // Determine category based on score
  let category = '';
  if (score >= 80) {
    category = 'excellent';
  } else if (score >= 60) {
    category = 'good';
  } else if (score >= 40) {
    category = 'fair';
  } else {
    category = 'poor';
  }
  
  return {
    score,
    max: maxScore,
    category
  };
}
