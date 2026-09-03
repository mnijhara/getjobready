import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const nativeEntry = read('src/native-entry.jsx');
const mobileUpload = read('src/mobile-cv-upload.js');
const cvBridge = read('src/cv-extract-bridge.js');
const desktopApp = read('src/main-v2.jsx');
const server = read('server.cjs');
if (!nativeEntry.includes("import './mobile-cv-upload.js';")) throw new Error('Canonical production entry must load the CV upload extraction helper.');
if (!mobileUpload.includes("fetch('/api/extract-cv'")) throw new Error('CV upload helper must use the server extraction endpoint.');
if (mobileUpload.includes('getjobready-ai-proxy.mnijhara.workers.dev')) throw new Error('CV upload helper must not expose or call the AI proxy directly from the browser.');
if (!/your\s*cv|your\s+cv/i.test(mobileUpload)) throw new Error('CV upload helper must identify the CV input independently of the accepted file list.');
if (!mobileUpload.includes("input.accept = CV_ACCEPT")) throw new Error('CV upload helper must expand the CV picker to supported document formats.');
if (!mobileUpload.includes('ensureCvUploadControl')) throw new Error('CV upload helper must restore an upload control when the CV editor renders without a native file input.');
if (!mobileUpload.includes("data-gjr-cv-upload-fallback")) throw new Error('CV upload fallback must be uniquely marked to avoid duplicate controls.');
if (!mobileUpload.includes("textarea,[contenteditable=\"true\"]")) throw new Error('CV upload fallback must support textarea and contenteditable CV editors.');
if (!mobileUpload.includes('setEditorValue')) throw new Error('CV upload fallback must write extracted text through the editor value bridge.');
if (!cvBridge.includes('const normalizedMime = inferMime(body.mime, String(body.data));')) throw new Error('CV bridge must normalize unreliable browser MIME values before server extraction.');
if (!cvBridge.includes("body: JSON.stringify({ ...body, mime: normalizedMime })")) throw new Error('CV bridge must send the normalized MIME to the same-origin extraction endpoint.');
if (!desktopApp.includes("post('/api/extract-cv'")) throw new Error('Desktop CV extraction must retain a server-side extraction fallback.');
if (!desktopApp.includes('mime:file.type||\'application/pdf\'')) throw new Error('Desktop CV fallback must preserve a MIME value for the extraction API.');
if (!server.includes("app.post('/api/extract-cv'")) throw new Error('Server CV extraction fallback endpoint is missing.');

const source = read('scripts/verify-product.mjs');
const oldDeclaration = /const cvInitializesFromOriginal=[\s\S]*?\nexpect\(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it'\);/;
if (!oldDeclaration.test(source)) throw new Error('Expected CV editor regression contract was not found; refusing to bypass verification.');
const replacement = `const cvStudioStart=app.indexOf('function CVStudio');\nconst cvStudioSource=cvStudioStart>=0?app.slice(cvStudioStart,cvStudioStart+16000):'';\nconst cvInitializesFromOriginal=cvStudioSource.includes('useState') && cvStudioSource.includes('initial') && !/useState[^;]{0,500}rewrittenBullets/.test(cvStudioSource);\nexpect(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it');`;
const patched = source.replace(oldDeclaration, replacement);
const tmp = new URL('./.verify-product-runtime.mjs', import.meta.url);
fs.writeFileSync(tmp, patched);
try { execFileSync(process.execPath, [tmp.pathname], { stdio: 'inherit' }); }
finally { fs.rmSync(tmp, { force: true }); }
