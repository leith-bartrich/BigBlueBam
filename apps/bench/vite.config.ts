import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/bench/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@bigbluebam/ui/launchpad': resolve(__dirname, '../../packages/ui/launchpad.tsx'),
      '@bigbluebam/ui/org-switcher': resolve(__dirname, '../../packages/ui/org-switcher.tsx'),
      '@bigbluebam/ui/notifications-bell': resolve(__dirname, '../../packages/ui/notifications-bell.tsx'),
      '@bigbluebam/ui/user-menu': resolve(__dirname, '../../packages/ui/user-menu.tsx'),
    },
  },
  server: {
    port: 3011,
    proxy: {
      '/bench/api': {
        target: 'http://localhost:4011',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bench\/api/, ''),
      },
    },
  },
});
