import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/worker.ts'],
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  sourcemap: true,
});
