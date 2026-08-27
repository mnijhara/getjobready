import { spawn } from 'node:child_process';

const port = 4174;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.cjs'], {
  env: { ...process.env, PORT: String(port), PUBLIC_BASE_URL: 'https://getjobready.online' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });

const stop = () => { if (!child.killed) child.kill('SIGTERM'); };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(1); });

try {
  const deadline = Date.now() + 10_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error(`Server did not become ready within 10 seconds. ${output}`);

  const allowed = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://getjobready.online' },
  });
  if (allowed.headers.get('access-control-allow-origin') !== 'https://getjobready.online') {
    throw new Error('Allowed production origin was not reflected by CORS.');
  }
  if (allowed.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error('Missing X-Content-Type-Options: nosniff.');
  }
  if (allowed.headers.get('x-frame-options') !== 'SAMEORIGIN') {
    throw new Error('Missing X-Frame-Options: SAMEORIGIN.');
  }
  if (allowed.headers.get('referrer-policy') !== 'strict-origin-when-cross-origin') {
    throw new Error('Missing strict Referrer-Policy.');
  }
  if (allowed.headers.get('permissions-policy') !== 'microphone=(self), camera=(), geolocation=()') {
    throw new Error('Permissions-Policy does not keep microphone access scoped to self.');
  }

  const blocked = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://evil.example' },
  });
  if (blocked.headers.has('access-control-allow-origin')) {
    throw new Error('Untrusted origin received an Access-Control-Allow-Origin header.');
  }

  const healthExemption = await fetch(`${base}/api/health`, {
    headers: { 'X-Forwarded-For': '198.51.100.10' },
  });
  if (!healthExemption.ok) throw new Error('Health endpoint should remain available to monitoring.');

  let rateLimited = false;
  for (let i = 0; i < 46; i += 1) {
    const response = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.11' },
      body: '{}',
    });
    if (response.status === 429) {
      rateLimited = true;
      break;
    }
    if (response.status !== 400) {
      throw new Error(`Unexpected protected API status during rate-limit test: ${response.status}`);
    }
  }
  if (!rateLimited) throw new Error('API rate limiter did not reject the protected route after the configured threshold.');

  console.log('PASS: CORS, security headers, health exemption and API rate limiting behave as expected.');
} finally {
  stop();
  await new Promise(resolve => child.once('exit', resolve));
  if (output && !output.includes('GetJobReady listening')) console.error(output);
}
