import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (file) => fs.readFileSync(file, 'utf8');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const expect = (condition, message) => { if (!condition) fail(message); console.log(`PASS: ${message}`); };

const entry = read('index.src.html');
const app = read('src/main-v2.jsx');
const modules = read('src/roadmap-modules.js');
const session = read('src/session-context.js');
const server = read('server.cjs');
const router = read('ai-router.cjs');

expect(entry.includes('/src/main-v2.jsx'), 'source production entrypoint uses the React student UI');
expect(app.includes('AI Audio Interview'), 'audio interview is present in the student UI');
expect(app.includes("prep==='general'"), 'general CV preparation mode exists');
expect(app.includes("prep==='specific'"), 'CV + JD preparation mode exists');
expect(app.includes('/api/interview-turn'), 'live interview sends turns to the adaptive interview API');
expect(app.includes('SpeechRecognition'), 'live interview uses browser speech recognition');
expect(app.includes('speechSynthesis'), 'live interview speaks questions aloud');
expect(app.includes('.docx'), 'CV upload accepts DOCX files supported by the backend');
expect(app.includes("sessionStorage.getItem('gjr_career')"), 'career selection restores from session state');
expect(app.includes("sessionStorage.setItem('gjr_career',value)"), 'career selection writes to session state');
expect(modules.includes('Selected drill:'), 'AI roadmap requests preserve the selected drill context');
expect(modules.includes('gjr-module-company'), 'demo module accepts a target company');
expect(modules.includes("'/api/demo'"), 'demo module uses the product demo API');
expect(modules.includes("'/api/coach'"), 'roadmap coaching modules use the AI coach API');
expect(modules.includes("'\"':'&quot;'"), 'generated demo HTML is safely escaped for iframe embedding');
expect(modules.includes('maxlength="6000"'), 'student module responses have a bounded input size');
expect(session.includes("sessionStorage.setItem(key,activeCareer())"), 'career selection persists across sessions');
expect(session.includes("body.career=read()"), 'analysis requests use the persisted career selection');
expect(server.includes("mode === 'general'"), 'server has separate general-CV AI interview logic');
expect(server.includes('ROLE-SPECIFIC CV + JD INTERVIEW'), 'server has explicit CV + JD interview logic');
expect(server.includes('ROLE-SPECIFIC CV + JD INTERVIEW. Use BOTH sources'), 'post-interview feedback evaluates both CV and JD');
expect(server.includes('CANDIDATE CV:\\n${String(cv).slice(0,40000)}\\n\\nTARGET JD:'), 'role-specific feedback prompt includes candidate CV and target JD');
expect(server.includes('X-Content-Type-Options'), 'security headers are enabled');
expect(server.includes('Permissions-Policy'), 'microphone permissions are explicitly scoped');
expect(server.includes('const allowedOrigin ='), 'API CORS policy defines the configured public origin');
expect(server.includes('origin === allowedOrigin'), 'API CORS rejects unexpected configured cross-origin requests');
expect(server.includes('RATE_MAX_BUCKETS = 5_000'), 'rate limiter has a bounded memory footprint');
expect(server.includes('cleanupRateBuckets'), 'rate limiter periodically removes stale buckets');
expect(server.includes('Too many requests'), 'API rate limiting is enabled');
expect(server.includes('app.listen(PORT'), 'production server starts successfully');
expect(server.includes("const parts = cvData && cvMime ? [{ text: prompt }, { inlineData: { mimeType: cvMime, data: cvData } }] : [{ text: prompt }];"), 'interview turns send the prompt once and attach uploaded CV context separately');
expect(router.includes('getjobready-ai-proxy.mnijhara.workers.dev'), 'AI router uses the server-side Cloudflare AI proxy');
expect(router.includes('keySlots: configured() ? 5 : 0'), 'AI router exposes the configured five-key proxy capacity without storing keys');
expect(router.includes('Cloudflare 5-key round-robin + automatic failover'), 'AI router documents five-key proxy failover');
expect(!/GEMINI_API_KEY_[0-9]+\s*=|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}/.test(`${entry}\n${app}\n${modules}\n${session}\n${server}\n${router}`), 'no provider API key or plaintext key assignment is committed to product source');

execFileSync(process.execPath, ['--check', 'server.cjs'], { stdio: 'inherit' });
console.log('PASS: server.cjs syntax check');

console.log('GetJobReady product verification passed.');
