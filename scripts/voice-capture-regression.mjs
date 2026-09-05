import { chromium } from 'playwright';

const BASE = process.env.GJR_BASE_URL || 'https://getjobready.online/';
const EXPECTED = 'I did a good job';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

await page.addInitScript(() => {
  class FakeRecognition {
    constructor() {
      this.listeners = {};
      this.onstart = null;
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
    }
    addEventListener(type, handler) {
      (this.listeners[type] ||= []).push(handler);
    }
    removeEventListener() {}
    dispatch(type, event) {
      this.listeners[type]?.forEach(fn => fn(event));
      this[`on${type}`]?.(event);
    }
    start() {
      this.dispatch('start', {});
      const final = text => ({ 0: { transcript: text, confidence: 0.99 }, length: 1, isFinal: true });
      const interim = text => ({ 0: { transcript: text, confidence: 0.99 }, length: 1, isFinal: false });
      setTimeout(() => this.dispatch('result', {
        resultIndex: 0,
        results: [final('I did a')]
      }), 150);
      setTimeout(() => this.dispatch('result', {
        resultIndex: 1,
        results: [final('I did a'), interim('good')]
      }), 300);
      setTimeout(() => this.dispatch('result', {
        resultIndex: 1,
        results: [final('I did a'), final('good job')]
      }), 450);
    }
    stop() { this.dispatch('end', {}); }
    abort() { this.dispatch('end', {}); }
  }

  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  window.speechSynthesis = {
    cancel() {},
    speak(utterance) { setTimeout(() => utterance.onend?.(), 50); },
    getVoices() { return [{ name: 'Google English India', lang: 'en-IN' }]; }
  };
});

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  const interview = page.getByText(/AI Audio Interview/i).first();
  if (!await interview.count()) throw new Error('AI Audio Interview entry point not found');
  await interview.click();
  await page.waitForTimeout(2500);

  const transcript = await page.locator('.transcript-card p.live').first().textContent().catch(() => '');
  if (transcript?.trim() === EXPECTED) {
    console.log(`[PASS] Voice transcript is exact: "${transcript.trim()}"`);
  } else {
    throw new Error(`Voice transcript mismatch. Expected "${EXPECTED}", got "${transcript?.trim() || ''}"`);
  }
} finally {
  await context.close();
  await browser.close();
}
