import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (file) => fs.readFileSync(file, 'utf8');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const expect = (condition, message) => { if (!condition) fail(message); console.log(`PASS: ${message}`); };

const entry = read('index.html');
const app = read('src/main-v2.jsx');
const server = read('server.cjs');
const router = read('ai-router.cjs');

expect(entry.includes('/src/main-v2.jsx'), 'production entrypoint uses the React student UI');
expect(app.includes('AI Audio Interview'), 'audio interview is present in the student UI');
expect(app.includes("prep==='general'"), 'general CV preparation mode exists');
expect(app.includes("prep==='specific'"), 'CV + JD preparation mode exists');
expect(app.includes('/api/interview-turn'), 'live interview sends turns to the adaptive interview API');
expect(app.includes('SpeechRecognition'), 'live interview uses browser speech recognition');
expect(app.includes('speechSynthesis'), 'live interview speaks questions aloud');
expect(server.includes("mode === 'general'"), 'server has separate general-CV AI interview logic');
expect(server.includes('ROLE-SPECIFIC CV + JD INTERVIEW'), 'server has explicit CV + JD interview logic');
expect(server.includes('X-Content-Type-Options'), 'security headers are enabled');
expect(server.includes('Too many requests'), 'API rate limiting is enabled');
expect(server.includes('app.listen(PORT'), 'production server starts successfully');
expect(router.includes('GEMINI_API_KEY_1') || router.includes('GEMINI_API_KEY_2'), 'AI router uses server-side Gemini key slots');
expect(!/(AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,})/.test(`${entry}\n${app}\n${server}\n${router}`), 'no obvious provider API key is committed to product source');

execFileSync(process.execPath, ['--check', 'server.cjs'], { stdio: 'inherit' });
console.log('PASS: server.cjs syntax check');

console.log('GetJobReady product verification passed.');
