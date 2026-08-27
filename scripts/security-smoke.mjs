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
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const allowed = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://getjobready.online' },
  });
  if (allowed.headers.get('access-control-allow-origin') !== 'https://getjobready.online') {
    throw new Error('Allowed production origin was not reflected by CORS.');
  }

  const blocked = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://evil.example' },
  });
  if (blocked.headers.has('access-control-allow-origin')) {
    throw new Error('Untrusted origin received an Access-Control-Allow-Origin header.');
  }

  console.log('PASS: CORS allows the production origin and blocks an untrusted browser origin.');
} finally {
  stop();
  await new Promise(resolve => child.once('exit', resolve));
  if (output && !output.includes('GetJobReady listening')) console.error(output);
}
