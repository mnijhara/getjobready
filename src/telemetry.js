// Lightweight production observability. Never log CV text, interview answers, tokens, or form payloads.
const SESSION_KEY = 'gjr_telemetry_session';
const MAX_MESSAGE = 500;
const MAX_QUEUE = 25;
let queue = [];
let installed = false;
let flushing = false;

function id() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function sessionId() {
  try {
    let value = localStorage.getItem(SESSION_KEY);
    if (!value) { value = id(); localStorage.setItem(SESSION_KEY, value); }
    return value;
  } catch { return 'no-local-storage'; }
}

function safeMessage(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE);
}

function safeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(meta).slice(0, 20)) {
    if (/cv|resume|answer|transcript|token|password|email|phone|secret|authorization|cookie/i.test(key)) continue;
    if (['string','number','boolean'].includes(typeof value) || value === null) out[key] = typeof value === 'string' ? value.slice(0, 300) : value;
  }
  return out;
}

async function send(entry) {
  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(entry),
      keepalive: true
    });
  } catch {}
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue.splice(0, MAX_QUEUE);
  try { await Promise.allSettled(batch.map(send)); } finally { flushing = false; if (queue.length) setTimeout(flush, 0); }
}

export function logEvent(event, metadata = {}, level = 'info', message = '') {
  const entry = {
    level: ['debug','info','warn','error'].includes(level) ? level : 'info',
    event: safeMessage(event) || 'unknown',
    path: `${location.pathname}${location.search}`.slice(0, 500),
    message: safeMessage(message),
    session_id: sessionId(),
    metadata: safeMeta(metadata)
  };
  queue.push(entry);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  if (level === 'error' || event === 'page_loaded') flush();
  else if (queue.length >= 5) flush();
}

export function installTelemetry() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  logEvent('page_loaded', {viewport: `${window.innerWidth}x${window.innerHeight}`, online: navigator.onLine}, 'info');

  window.addEventListener('error', event => {
    logEvent('uncaught_error', {filename: event.filename || '', line: event.lineno || 0, column: event.colno || 0}, 'error', event.error?.message || event.message || 'Unknown browser error');
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    logEvent('unhandled_rejection', {}, 'error', reason?.message || String(reason || 'Unknown promise rejection'));
  });
  window.addEventListener('online', () => logEvent('network_online'));
  window.addEventListener('offline', () => logEvent('network_offline', {}, 'warn'));
  document.addEventListener('visibilitychange', () => logEvent(document.hidden ? 'page_hidden' : 'page_visible'));
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('button,a,[role="button"]');
    if (!target) return;
    const label = safeMessage(target.getAttribute('aria-label') || target.textContent || target.title);
    if (label) logEvent('user_click', {element: target.tagName.toLowerCase(), label});
  }, true);

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const request = args[0];
    const url = typeof request === 'string' ? request : request?.url || '';
    const method = (args[1]?.method || request?.method || 'GET').toUpperCase();
    const start = performance.now();
    try {
      const response = await originalFetch(...args);
      if (url.includes('/api/') && !url.includes('/api/client-log')) {
        logEvent(response.ok ? 'api_response' : 'api_error', {method, endpoint: new URL(url, location.origin).pathname, status: response.status, duration_ms: Math.round(performance.now() - start)}, response.ok ? 'info' : 'error', response.ok ? '' : `API ${response.status}`);
      }
      return response;
    } catch (error) {
      if (url.includes('/api/') && !url.includes('/api/client-log')) logEvent('api_network_error', {method, endpoint: new URL(url, location.origin).pathname, duration_ms: Math.round(performance.now() - start)}, 'error', error?.message || 'Network request failed');
      throw error;
    }
  };
  window.addEventListener('pagehide', () => { if (queue.length) flush(); });
  setInterval(flush, 10000);
}
