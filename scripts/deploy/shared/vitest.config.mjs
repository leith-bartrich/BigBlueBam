// Minimal vitest config for the deploy/shared unit tests.
//
// Written as a plain object (no `import from "vitest/config"`) because this
// directory sits outside any pnpm workspace, so `vitest` isn't resolvable
// from here. Vitest accepts a plain default-exported config object.
//
// `root` is set explicitly to this directory so that the `include` glob is
// relative to it regardless of the process cwd used to invoke vitest.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  root: __dirname,
  test: {
    globals: true,
    environment: 'node',
    include: ['*.test.mjs', '../platforms/*.test.mjs'],
  },
};
