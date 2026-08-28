// Stable browser-facing PDF.js worker entrypoint.
// The full worker is committed in dist so this remains tiny and deployment-safe.
import './dist/pdf.worker.mjs';
