import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Hostinger was returning 404 for Vite's hashed .mjs worker asset. Keep the
// worker at a stable URL and prevent the existing app code from resetting it.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

const stableWorkerOptions = new Proxy(pdfjsLib.GlobalWorkerOptions, {
  set(target, property, value) {
    if (property === 'workerSrc' && !value) value = '/pdf.worker.mjs';
    target[property] = value;
    return true;
  }
});

export const getDocument = pdfjsLib.getDocument;
export const GlobalWorkerOptions = stableWorkerOptions;
