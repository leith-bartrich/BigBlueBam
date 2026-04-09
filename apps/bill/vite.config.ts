import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/bill/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3014,
    proxy: {
      '/bill/api': {
        target: 'http://localhost:4014',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bill\/api/, ''),
      },
    },
  },
});
