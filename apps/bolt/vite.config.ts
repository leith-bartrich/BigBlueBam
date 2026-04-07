import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/bolt/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3006,
    proxy: {
      '/bolt/api': {
        target: 'http://localhost:4006',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bolt\/api/, ''),
      },
    },
  },
});
