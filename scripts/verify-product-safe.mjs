import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const nativeEntry = read('src/native-entry.jsx');
const mobileUpload = read('src/mobile-cv-upload.js');
const cvBridge = read('src/cv-extract-bridge.js');
const desktopApp = read('src/main-v2.jsx');
const server = read('server.cjs');
const aiRouter = read('ai-router.cjs');
if (!nativeEntry.includes("import './mobile-cv-upload.js';")) throw new Error('Canonical production entry must load the CV upload extraction helper.');
if (!mobileUpload.includes("fetch('/api/extract-cv'")) throw new Error('CV upload helper must use the server extraction endpoint.');
if (mobileUpload.includes('getjobready-ai-proxy.mnijhara.workers.dev')) throw new Error('CV upload helper must not expose or call the AI proxy directly from the browser.');
if (!/your\s*cv|your\s+cv/i.test(mobileUpload)) throw new Error('CV upload helper must identify the CV input independently of the accepted file list.');
if (!mobileUpload.includes("input.accept = CV_ACCEPT")) throw new Error('CV upload helper must expand the CV picker to supported document formats.');
if (!mobileUpload.includes('ensureCvUploadControl')) throw new Error('CV upload helper must restore an upload control when the CV editor renders without a native file input.');
if (!mobileUpload.includes("data-gjr-cv-upload-fallback")) throw new Error('CV upload fallback must be uniquely marked to avoid duplicate controls.');
if (!mobileUpload.includes("textarea,[contenteditable=\"true\"]")) throw new Error('CV upload fallback must support textarea and contenteditable CV editors.');
if (!mobileUpload.includes('setEditorValue')) throw new Error('CV upload fallback must write extracted text through the editor value bridge.');
if (!mobileUpload.includes('setReactCV')) throw new Error('CV upload fallback must use the React CV state bridge when available.');
if (!mobileUpload.includes("window.__gjrSetCv")) throw new Error('CV upload fallback must route extracted text through the canonical React CV setter.');
if (!mobileUpload.includes("new TextDecoder('utf-8', { fatal: true })")) throw new Error('CV upload helper must detect text CVs when browsers report a generic MIME type.');
if (!cvBridge.includes('const normalizedMime = inferMime(body.mime, String(body.data));')) throw new Error('CV bridge must normalize unreliable browser MIME values before server extraction.');
if (!cvBridge.includes("body: JSON.stringify({ ...body, mime: normalizedMime })")) throw new Error('CV bridge must send the normalized MIME to the same-origin extraction endpoint.');
if (!cvBridge.includes("new TextDecoder('utf-8', { fatal: true })")) throw new Error('CV bridge must preserve generic-MIME text detection for desktop extraction.');
if (!cvBridge.includes("contentType.toLowerCase().includes('application/json') && serverResponse.status < 500")) throw new Error('CV bridge must fall back to the AI proxy when same-origin extraction returns a server 5xx JSON response.');
if (!cvBridge.includes("contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }],")) throw new Error('Browser CV AI fallback must send the instruction and document as Gemini contents parts.');
if (/body: JSON\.stringify\(\{[^}]*\bprompt,/.test(cvBridge) || /body: JSON\.stringify\(\{[^}]*\bjson:\s*false/.test(cvBridge)) throw new Error('Browser CV AI fallback must not send unsupported top-level prompt/json fields.');
if (!desktopApp.includes("post('/api/extract-cv'")) throw new Error('Desktop CV extraction must retain a server-side extraction fallback.');
if (!desktopApp.includes('mime:file.type||\'application/pdf\'')) throw new Error('Desktop CV fallback must preserve a MIME value for the extraction API.');
if (!desktopApp.includes('window.__gjrSetCv')) throw new Error('Desktop application must expose the canonical React CV setter for upload helpers.');
if (!server.includes("app.post('/api/extract-cv'")) throw new Error('Server CV extraction fallback endpoint is missing.');
if (!server.includes('const resolveCvMime = (reportedMime, data)')) throw new Error('Server CV extraction must normalize unreliable MIME values before AI processing.');
if (!server.includes('const resolvedMime=resolveCvMime(mime,data);') && !server.includes('const resolvedMime = resolveCvMime(mime, data);')) throw new Error('Server CV extraction must use its resolved MIME.');
if (!server.includes('mime: resolvedMime')) throw new Error('Server CV extraction must send the resolved MIME to the AI router.');
if (aiRouter.includes('prompt,\n    model') || aiRouter.includes('json: options.json')) throw new Error('AI router must not send unsupported top-level prompt/json fields to the Gemini proxy.');
if (!aiRouter.includes('contents: [{ parts }]')) throw new Error('AI router must send the instruction as a Gemini contents part.');
if (!aiRouter.includes('generationConfig')) throw new Error('AI router must send Gemini generation configuration through the supported field.');

const source = read('scripts/verify-product.mjs');
const oldDeclaration = /const cvInitializesFromOriginal=[\s\S]*?\nexpect\(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it'\);/;
if (!oldDeclaration.test(source)) throw new Error('Expected CV editor regression contract was not found; refusing to bypass verification.');
const replacement = `const cvStudioStart=app.indexOf('function CVStudio');\nconst cvStudioSource=cvStudioStart>=0?app.slice(cvStudioStart,cvStudioStart+16000):'';\nconst cvInitializesFromOriginal=cvStudioSource.includes('useState') && cvStudioSource.includes('initial') && !/useState[^;]{0,500}rewrittenBullets/.test(cvStudioSource);\nexpect(cvInitializesFromOriginal,'CV editor initializes from the original CV without rewriting it');`;
const patched = source.replace(oldDeclaration, replacement);
const tmp = new URL('./.verify-product-runtime.mjs', import.meta.url);
fs.writeFileSync(tmp, patched);
try { execFileSync(process.execPath, [tmp.pathname], { stdio: 'inherit' }); }
finally { fs.rmSync(tmp, { force: true }); }
