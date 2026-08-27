import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Always use a stable, explicitly deployed worker URL. Hostinger was returning
// 404 for Vite's hashed .mjs worker asset, which made PDF uploads fail.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export const getDocument = pdfjsLib.getDocument;
export const GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions;
