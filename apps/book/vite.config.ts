import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/book/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3012,
    proxy: {
      '/book/api': {
        target: 'http://localhost:4012',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/book\/api/, ''),
      },
    },
  },
});
