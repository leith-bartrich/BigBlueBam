import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/blank/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@bigbluebam/ui/launchpad': resolve(__dirname, '../../packages/ui/launchpad.tsx'),
    },
  },
  server: {
    port: 3013,
    proxy: {
      '/blank/api': {
        target: 'http://localhost:4013',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/blank\/api/, ''),
      },
    },
  },
});
