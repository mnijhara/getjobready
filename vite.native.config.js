import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const scannedPdfFallback = () => ({
  name: 'getjobready-scanned-pdf-fallback',
  transform(code, id) {
    if (!id.endsWith('/src/main-v2.jsx')) return null;
    const blocked = "throw new Error('Could not extract text from this PDF file. Please paste your CV text into the text box below.');";
    if (!code.includes(blocked)) return null;
    const replacement = "console.warn('PDF contains no embedded text; sending the original PDF to document-aware AI analysis.'); return '';";
    return { code: code.replace(blocked, replacement), map: null };
  }
});

export default defineConfig({
  plugins: [scannedPdfFallback(), react()],
  resolve: {
    alias: [
      { find: /^pdfjs-dist$/, replacement: fileURLToPath(new URL('./src/pdfjs-browser.js', import.meta.url)) }
    ]
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./native.html', import.meta.url))
    }
  }
});
