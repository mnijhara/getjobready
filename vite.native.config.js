import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^pdfjs-dist$/, replacement: fileURLToPath(new URL('./src/pdfjs-browser.js', import.meta.url)) }
    ]
  },
  server: { port: 5173 },
  build: {
    input: fileURLToPath(new URL('./native.html', import.meta.url))
  }
});
