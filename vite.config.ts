import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // also listen on the LAN so it can be opened from a phone/tablet on the same Wi-Fi
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
