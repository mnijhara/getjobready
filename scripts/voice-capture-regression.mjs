import { chromium } from 'playwright';

const BASE = process.env.GJR_BASE_URL || 'https://getjobready.online/';
const EXPECTED = 'I did a good job';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['microphone'] });

// Install the browser fakes before the application is loaded. The previous
// regression installed them too late in some flows and also did not seed the
// lightweight local profile, so the test could stop at the login gate without
// ever exercising VoiceInterview.
await context.addInitScript(() => {
  const profile = JSON.stringify({
    email: 'voice-regression@example.com',
    joined: new Date().toISOString()
  });
  localStorage.setItem('gjr_profile', profile);
  localStorage.setItem('gjr_master_cv_voice-regression_example_com', 'Voice regression CV');

  class FakeRecognition {
    constructor() {
      this.listeners = {};
      this.onstart = null;
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
      this.lang = 'en-IN';
      this.interimResults = true;
      this.continuous = true;
    }
    addEventListener(type, handler) {
      (this.listeners[type] ||= []).push(handler);
    }
    removeEventListener(type, handler) {
      this.listeners[type] = (this.listeners[type] || []).filter(fn => fn !== handler);
    }
    dispatch(type, event) {
      this.listeners[type]?.forEach(fn => fn(event));
      this[`on${type}`]?.(event);
    }
    start() {
      this.dispatch('start', {});
      const result = (items) => ({
        resultIndex: 0,
        results: items.map(({ text, final }) => ({
          0: { transcript: text, confidence: 0.99 },
          length: 1,
          isFinal: final
        }))
      });
      setTimeout(() => this.dispatch('result', result([
        { text: 'I did a', final: true }
      ])), 150);
      setTimeout(() => this.dispatch('result', result([
        { text: 'I did a', final: true },
        { text: 'good', final: false }
      ])), 300);
      setTimeout(() => this.dispatch('result', result([
        { text: 'I did a', final: true },
        { text: 'good job', final: true }
      ])), 450);
    }
    stop() { this.dispatch('end', {}); }
    abort() { this.dispatch('end', {}); }
  }

  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  window.speechSynthesis = {
    cancel() {},
    speak(utterance) { setTimeout(() => utterance.onend?.(), 50); },
    getVoices() { return [{ name: 'Google English India', lang: 'en-IN' }]; },
    onvoiceschanged: null
  };
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);

  const interview = page.getByText(/AI Audio Interview/i).first();
  if (!await interview.count()) throw new Error('AI Audio Interview entry point not found');
  await interview.click();

  // The app can render the interview after a short async transition. Do not
  // use a fixed 2.5s sleep as the only synchronization point.
  await page.getByText(/QUESTION\s+1\s+OF/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.transcript-card').waitFor({ state: 'visible', timeout: 10000 });

  // VoiceInterview auto-starts after its question is spoken. Wait for the
  // actual transcript instead of assuming a timing window.
  const liveTranscript = page.locator('.transcript-card p.live').first();
  await liveTranscript.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(
    expected => document.querySelector('.transcript-card p.live')?.textContent?.trim() === expected,
    EXPECTED,
    { timeout: 10000 }
  );

  const transcript = (await liveTranscript.textContent()).trim();
  console.log(`[PASS] Voice transcript is exact: "${transcript}"`);
  if (errors.length) console.log(`[INFO] Browser diagnostics: ${errors.join(' | ')}`);
} finally {
  await context.close();
  await browser.close();
}
