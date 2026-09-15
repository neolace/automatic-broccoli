import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Must match the development redirect URI registered in Entra.
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Hashed asset names allow the site Lambda to cache them immutably; index.html stays refreshable.
    sourcemap: false,
  },
});
