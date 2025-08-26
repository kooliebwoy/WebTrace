import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
  redirectCheck: async ({ request }) => {
    console.log('[Server Action] redirectCheck started.'); // <-- Log start

    const formData = await request.formData();
    const url = formData.get('url');
    console.log('[Server Action] Received URL:', url); // <-- Log received URL

    if (!url || typeof url !== 'string') {
      console.error('[Server Action] Error: No URL provided.'); // <-- Log error
      return fail(400, { error: 'No URL provided' });
    }
    
    // Ensure URL has a protocol
    let formattedUrl = url.trim();
    try {
      // If URL doesn't parse correctly, it might be missing a protocol
      new URL(formattedUrl);
    } catch (e) {
      // Add https:// if no protocol is specified
      if (!formattedUrl.match(/^https?:\/\//i)) {
        formattedUrl = `https://${formattedUrl}`;
        console.log('[Server Action] Added https:// protocol:', formattedUrl);
      }
    }

    try {
      let currentUrl = formattedUrl; // Use the formatted URL with protocol
      let redirects: Array<{from: string, to: string, status: number, headers: Record<string, string>}> = [];
      let maxRedirects = 10;
      let count = 0;
      let finalStatus = 0; // Variable to store the final status
      let finalHeaders: Record<string, string> = {}; // Store final response headers

      console.log('[Server Action] Starting fetch loop for:', currentUrl); // <-- Log fetch start

      while (count < maxRedirects) {
        // Use GET instead of HEAD to get a more complete picture of headers
        const res = await fetch(currentUrl, { method: 'GET', redirect: 'manual' });
        console.log(`[Server Action] Fetch status for ${currentUrl}:`, res.status);
        
        // Collect response headers
        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          const nextUrl = new URL(loc, currentUrl).href;
          console.log(`[Server Action] Redirect found: ${currentUrl} -> ${nextUrl} (${res.status})`); // <-- Log redirect
          
          // Store the redirect with headers
          redirects.push({ 
            from: currentUrl, 
            to: nextUrl, 
            status: res.status,
            headers: headers
          });
          
          currentUrl = nextUrl;
          count++;
        } else {
          console.log('[Server Action] Fetch loop ending. No more redirects or non-redirect status.'); // <-- Log loop end
          finalStatus = res.status; // Capture the final status
          finalHeaders = headers; // Store the headers from the final response
          break;
        }
      }
      console.log('[Server Action] Returning success:', { chain: redirects, final: currentUrl, finalStatus: finalStatus }); // <-- Log success return
      return { 
        chain: redirects, 
        final: currentUrl, 
        finalStatus: finalStatus,
        finalHeaders: finalHeaders // Include headers from the final destination
      };
    } catch (e: any) { // <-- Added type annotation for e
      console.error('[Server Action] Error during fetch:', e.message); // <-- Log fetch error
      return fail(500, { error: e.message, finalStatus: 0 }); 
    }
  }
};
