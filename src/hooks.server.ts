// This file provides server hooks for SvelteKit
// It helps handle Node.js modules in Cloudflare Workers

import { sequence } from "@sveltejs/kit/hooks";
import { redirect, type Handle, error } from '@sveltejs/kit';

// /** @type {import('@sveltejs/kit').Handle} */
// export async function handleRequest({ event, resolve }) {
//   // This ensures all requests are processed properly
//   return await resolve(event);
// }

// export const handle = sequence(authHandle);


// lets check our service binding
// const getService = async ({ event, resolve }) => {
//     const service = event.platform.env.SERVICE;
//     if (!service) {
//         throw new Error('Service binding not found');
//     }
//     const data = await service.getClientDO('randomIdstring');
//     console.log(data);

//     return resolve(event)
// }



// export const handle: Handle = sequence (
//     getService
// );