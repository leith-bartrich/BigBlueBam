import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/board/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3008,
    proxy: {
      '/board/api': {
        target: 'http://localhost:4008',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/board\/api/, ''),
      },
    },
  },
});
