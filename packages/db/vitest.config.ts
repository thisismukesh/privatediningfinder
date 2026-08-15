import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/diner_test',
    },
  },
});
