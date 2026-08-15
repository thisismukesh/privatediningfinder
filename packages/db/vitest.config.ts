import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share one physical diner_test database; running test files in
    // parallel races schema resets against live queries. See §3.2.
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/diner_test',
    },
  },
});
