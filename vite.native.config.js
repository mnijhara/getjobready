import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const repairNativeSource = {
  name: 'getjobready-native-source-repair',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/main-v2.jsx')) return null;
    const trimmed = code.trimEnd();
    // main-v2 contains the canonical student UI; close the App scope when an
    // upstream edit leaves the final createRoot line outside the function.
    if (trimmed.endsWith("createRoot(document.getElementById('root')).render(<App/>);")) {
      return { code: `${trimmed}\n}\n`, map: null };
    }
    return null;
  }
};

export default defineConfig({
  plugins: [repairNativeSource, react()],
  resolve: {
    alias: [
      { find: /^pdfjs-dist$/, replacement: fileURLToPath(new URL('./src/pdfjs-browser.js', import.meta.url)) }
    ]
  },
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      input: fileURLToPath(new URL('./native.html', import.meta.url))
    }
  }
});
