import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Barrel re-export files (`export * from './x.js'`) have no branches to cover;
      // everything else in packages/domain is held to the 100% branch gate (§14 Phase 1).
      exclude: ['**/index.ts', '**/*.test.ts', '**/*.config.ts'],
      thresholds: {
        branches: 100,
      },
    },
  },
});
