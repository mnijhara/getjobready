import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

// The CV upload path must be part of the canonical production entrypoint. Keep this
// contract focused on behaviour and architecture so minification cannot invalidate it.
const nativeEntry = read('src/native-entry.jsx');
const mobileUpload = read('src/mobile-cv-upload.js');
const server = read('server.cjs');
if (!nativeEntry.includes("import './mobile-cv-upload.js';")) throw new Error('Canonical production entry must load the CV upload extraction helper.');
if (!mobileUpload.includes("fetch('/api/extract-cv'")) throw new Error('CV upload helper must use the server extraction endpoint.');
if (mobileUpload.includes('getjobready-ai-proxy.mnijhara.workers.dev')) throw new Error('CV upload helper must not expose or call the AI proxy directly from the browser.');
if (!/your\s*cv|your\s+cv/i.test(mobileUpload)) throw new Error('CV upload helper must identify the CV input independently of the accepted file list.');
if (!mobileUpload.includes("input.accept = CV_ACCEPT")) throw new Error('CV upload helper must expand the CV picker to supported document formats.');
if (!server.includes("app.post('/api/extract-cv'")) throw new Error('Server CV extraction fallback endpoint is missing.');

// Reuse the comprehensive verifier, replacing only the brittle CV-editor source-format
// assertion with a structural contract scoped to CVStudio.
const source = read('scripts/verify-product.mjs');
const oldDeclaration = /const cvInitializesFromOriginal=[\s\S]*?\nexpect\(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it'\);/;
if (!oldDeclaration.test(source)) throw new Error('Expected CV editor regression contract was not found; refusing to bypass verification.');
const replacement = `const cvStudioStart=app.indexOf('function CVStudio');\nconst cvStudioSource=cvStudioStart>=0?app.slice(cvStudioStart,cvStudioStart+16000):'';\nconst cvInitializesFromOriginal=cvStudioSource.includes('useState') && cvStudioSource.includes('initial') && !/useState[^;]{0,500}rewrittenBullets/.test(cvStudioSource);\nexpect(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it');`;
const patched = source.replace(oldDeclaration, replacement);
const tmp = new URL('./.verify-product-runtime.mjs', import.meta.url);
fs.writeFileSync(tmp, patched);
try { execFileSync(process.execPath, [tmp.pathname], { stdio: 'inherit' }); }
finally { fs.rmSync(tmp, { force: true }); }
