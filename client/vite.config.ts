import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API and Socket.io are proxied, so the refresh cookie is same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
