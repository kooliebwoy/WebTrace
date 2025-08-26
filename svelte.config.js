import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-vercel: Deploy SvelteKit to Vercel
		// See https://svelte.dev/docs/kit/adapter-vercel for configuration options
		adapter: adapter({
			runtime: 'nodejs22.x'
		})
	}
};

export default config;
