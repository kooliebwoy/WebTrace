import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
/// <reference types="vitest" />

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit()
	],
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}'],
		testTimeout: 10000 // 10 seconds for timeout tests
	}
});
