import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { createCloudflareCompatPlugin } from './cloudflare-worker-compat';

export default defineConfig({
	plugins: [
		createCloudflareCompatPlugin(),
		tailwindcss(), 
		sveltekit()
	],
	// Define these modules as external to prevent bundling
	build: {
		commonjsOptions: {
			ignore: ['node:dns', 'node:tls', 'node:net']
		}
	},
	optimizeDeps: {
		exclude: ['node:dns', 'node:tls', 'node:net']
	},
	define: {
		// Force Vite to treat these modules as external at build time
		'import.meta.CLOUDFLARE_WORKER': 'true'
	}
});
