import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(root, '..');
const candidates = [
  path.join(project, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
  path.join(project, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
];
const source = candidates.find((p) => fs.existsSync(p));
if (!source) throw new Error('pdfjs-dist worker module was not found after npm install');
const publicDir = path.join(project, 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(source, path.join(publicDir, 'pdf.worker.mjs'));
console.log(`Prepared stable PDF worker from ${source}`);
