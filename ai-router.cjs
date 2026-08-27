const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const WORKER_URL = (process.env.AI_PROXY_URL || 'https://getjobready-ai-proxy.mnijhara.workers.dev').replace(/\/$/, '');
const GENERATE_URL = `${WORKER_URL}/generate`;

// Gemini keys live in the Cloudflare Worker. GetJobReady never receives or stores them.
let workerFailures = 0;
let workerCooldownUntil = 0;
let workerRequests = 0;
let lastWorkerUse = 0;

function configured() { return Boolean(WORKER_URL); }
function publicStatus() {
  const healthy = Date.now() >= workerCooldownUntil;
  return {
    configured: configured(),
    keySlots: configured() ? 5 : 0,
    healthySlots: configured() && healthy ? 5 : 0,
    model: DEFAULT_MODEL,
    router: 'Cloudflare 5-key round-robin + automatic failover',
    proxy: WORKER_URL,
    requests: workerRequests,
    lastRequestAt: lastWorkerUse || null,
  };
}
function markFailure(status) {
  workerFailures += 1;
  const seconds = status === 429 ? Math.min(90, 10 * workerFailures) : status === 401 || status === 403 ? 300 : 15;
  workerCooldownUntil = Date.now() + seconds * 1000;
}
function markSuccess() {
  workerFailures = 0;
  workerCooldownUntil = 0;
}
function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch { throw new Error('Gemini returned invalid JSON'); }
}
function extractText(data) {
  if (typeof data === 'string') return data;
  if (data?.candidates?.[0]?.content?.parts) return data.candidates[0].content.parts.map(p => p.text || '').join('');
  if (typeof data?.text === 'string') return data.text;
  if (typeof data?.output === 'string') return data.output;
  if (typeof data?.response === 'string') return data.response;
  if (typeof data?.result === 'string') return data.result;
  if (data?.result && typeof data.result === 'object') return JSON.stringify(data.result);
  return '';
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const REQUEST_TIMEOUT_MS = 25_000;

async function generate(prompt, options = {}) {
  if (!configured()) throw Object.assign(new Error('AI_NOT_CONFIGURED'), { code: 'AI_NOT_CONFIGURED' });
  if (Date.now() < workerCooldownUntil) throw new Error('AI_PROXY_COOLDOWN');

  // The proxy receives the instruction in `prompt`. Keep only additional multimodal
  // parts in `contents` so the same prompt is not tokenized twice on every request.
  const suppliedParts = options.parts || [{ text: prompt }];
  const parts = suppliedParts.filter((part, index) => !(index === 0 && part?.text === prompt));
  const model = options.model || DEFAULT_MODEL;
  const generationConfig = {
    responseMimeType: options.responseMimeType || 'application/json',
    maxOutputTokens: options.maxOutputTokens || 6000,
  };
  const body = {
    prompt,
    model,
    contents: parts.length ? [{ parts }] : [],
    generationConfig,
    json: options.json !== false,
  };

  workerRequests += 1;
  lastWorkerUse = Date.now();
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await sleep(response.status === 429 ? 250 * attempt : 150 * attempt);
          continue;
        }
        markFailure(response.status);
        throw new Error(`AI proxy ${response.status}: ${errorBody.slice(0, 300)}`);
      }
      const data = await response.json();
      const text = extractText(data);
      if (!text) {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          markSuccess();
          return options.json === false ? JSON.stringify(data) : data;
        }
        throw new Error('AI proxy returned an empty response');
      }
      markSuccess();
      return options.json === false ? text : parseJson(text);
    } catch (error) {
      clearTimeout(timeout);
      const message = String(error.message || '');
      const retryableNetwork = !message.startsWith('AI proxy ') && attempt < maxAttempts;
      if (retryableNetwork) {
        await sleep(150 * attempt);
        continue;
      }
      if (!message.startsWith('AI proxy ')) markFailure(500);
      throw error;
    }
  }
  throw new Error('AI proxy request failed');
}

module.exports = { generate, publicStatus, configured };
