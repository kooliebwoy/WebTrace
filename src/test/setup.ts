/**
 * Vitest setup file
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock global fetch function
global.fetch = vi.fn();

// Setup AbortController and related APIs for Node.js environment
if (!globalThis.AbortController) {
  const { AbortController, AbortSignal } = await import('abort-controller');
  globalThis.AbortController = AbortController;
  globalThis.AbortSignal = AbortSignal;
}

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});
