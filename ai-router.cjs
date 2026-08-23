const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const slots = Array.from({ length: 5 }, (_, i) => ({ index: i + 1, key: process.env[`GEMINI_API_KEY_${i + 1}`] || '', failures: 0, cooldownUntil: 0, requests: 0, lastUsed: 0 })).filter(s => s.key);
if (!slots.length && process.env.GEMINI_API_KEY) slots.push({ index: 0, key: process.env.GEMINI_API_KEY, failures: 0, cooldownUntil: 0, requests: 0, lastUsed: 0 });
let cursor = 0;
function configured() { return slots.length > 0; }
function publicStatus() { return { configured: configured(), keySlots: slots.length, healthySlots: slots.filter(s => Date.now() >= s.cooldownUntil).length, model: DEFAULT_MODEL, router: 'round-robin + automatic failover' }; }
function nextSlot() {
  if (!slots.length) return null;
  const now = Date.now();
  for (let i = 0; i < slots.length; i++) {
    const pos = (cursor + i) % slots.length, slot = slots[pos];
    if (now >= slot.cooldownUntil) { cursor = (pos + 1) % slots.length; slot.lastUsed = now; slot.requests += 1; return slot; }
  }
  return [...slots].sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0];
}
function markFailure(slot, status) {
  slot.failures += 1;
  const seconds = status === 429 ? Math.min(90, 10 * slot.failures) : status === 401 || status === 403 ? 300 : 15;
  slot.cooldownUntil = Date.now() + seconds * 1000;
}
function markSuccess(slot) { slot.failures = 0; slot.cooldownUntil = 0; }
function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch { throw new Error('Gemini returned invalid JSON'); }
}
async function generate(prompt, options = {}) {
  if (!configured()) throw Object.assign(new Error('AI_NOT_CONFIGURED'), { code: 'AI_NOT_CONFIGURED' });
  const attempts = Math.min(slots.length, options.attempts || slots.length);
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const slot = nextSlot(); if (!slot) break;
    try {
      const parts = options.parts || [{ text: prompt }];
      const model = options.model || DEFAULT_MODEL;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(slot.key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: options.temperature ?? 0.25, responseMimeType: options.responseMimeType || 'application/json', maxOutputTokens: options.maxOutputTokens || 6000 } }),
      });
      if (!response.ok) { const body = await response.text().catch(() => ''); markFailure(slot, response.status); lastError = new Error(`Gemini ${response.status}: ${body.slice(0, 300)}`); continue; }
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!text) throw new Error('Gemini returned an empty response');
      markSuccess(slot);
      return options.json === false ? text : parseJson(text);
    } catch (error) { lastError = error; markFailure(slot, 500); }
  }
  throw lastError || new Error('No Gemini key available');
}
module.exports = { generate, publicStatus, configured };
