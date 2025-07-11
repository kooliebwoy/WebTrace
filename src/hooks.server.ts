// This file provides server hooks for SvelteKit
// It helps handle Node.js modules in Cloudflare Workers

import { sequence } from "@sveltejs/kit/hooks";
import { handle as authHandle } from '$lib/server/auth';

// /** @type {import('@sveltejs/kit').Handle} */
// export async function handleRequest({ event, resolve }) {
//   // This ensures all requests are processed properly
//   return await resolve(event);
// }

// export const handle = sequence(authHandle);

// Empty exports to prevent build errors for Node modules
// These will be provided by Cloudflare Workers at runtime
export const dnsShim = {};
export const tlsShim = { connect: () => {} };
export const netShim = {};
