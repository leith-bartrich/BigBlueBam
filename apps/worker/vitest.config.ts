import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {

    // CI runners sometimes blow through the 5s default on first-test-in-file

    // import cost (drizzle + peer-app-stubs can take multiple seconds).

    testTimeout: 30_000,

    hookTimeout: 30_000,
    environment: 'node',
    globals: true,
  },
});
