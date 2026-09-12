import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/shipments': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/facilities': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/generators': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/carbon': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
