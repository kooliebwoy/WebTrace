import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
/// <reference types="vitest" />

export default defineConfig({
	plugins: [
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
	},
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}'],
		testTimeout: 10000 // 10 seconds for timeout tests
	}
});
