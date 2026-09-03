import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = 'https://getjobready.online/';
const expectedSha = process.env.GITHUB_SHA || '';
const dir = process.env.GJR_AUDIT_FILES || '/tmp/gjr-audit';
const results = [];
const failures = [];
const pass = msg => { results.push({ kind: 'pass', msg }); console.log('[PASS]', msg); };
const info = msg => { results.push({ kind: 'info', msg }); console.log('[INFO]', msg); };
const fail = msg => { failures.push(msg); console.error('[FAIL]', msg); };

async function settle(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}

async function openModule(page, matcher, label) {
  await settle(page);
  const target = page.getByText(matcher).first();
  if (!await target.count() || !await target.isVisible().catch(() => false)) {
    info(`${label}: target not exposed`);
    return false;
  }
  try {
    await target.scrollIntoViewIfNeeded();
    await target.click({ timeout: 10000 });
    await page.waitForTimeout(700);
    pass(`${label} opened`);
    return true;
  } catch (e) {
    fail(`${label}: ${e.message}`);
    return false;
  }
}

async function verifyDeployment(page, name) {
  if (!expectedSha) {
    info(`${name}: GITHUB_SHA unavailable; skipping deployment identity assertion`);
    return;
  }
  try {
    const response = await page.request.get(new URL('/build-info.json', base).toString(), { timeout: 10000 });
    if (!response.ok()) throw new Error(`build-info HTTP ${response.status()}`);
    const infoJson = await response.json();
    if (infoJson.sha !== expectedSha) {
      throw new Error(`live SHA ${infoJson.sha || 'missing'} does not match expected ${expectedSha}`);
    }
    pass(`${name}: live deployment SHA matches ${expectedSha}`);
  } catch (e) {
    fail(`${name}: deployment identity check failed: ${e.message}`);
  }
}

async function upload(page, file, label) {
  const path = `${dir}/${file}`;
  if (!fs.existsSync(path)) { fail(`${label}: fixture missing ${file}`); return false; }
  try {
    const input = page.locator('input[type=file]').first();
    if (!await input.count()) throw new Error('CV file input missing');
    await input.setInputFiles(path);
    pass(`${label}: uploaded ${file}`);
    return true;
  } catch (e) {
    fail(`${label}: upload ${file}: ${e.message}`);
    return false;
  }
}

async function assertExtracted(page, file, label) {
  const editor = page.locator('#cvText');
  try {
    await editor.waitFor({ state: 'attached', timeout: 5000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('#cvText');
      return !!el && /Alex Student|Computer Science Student|placement tracker/i.test(el.value || '');
    }, { timeout: 10000 });
    const value = await editor.inputValue();
    const box = await editor.boundingBox();
    if (!box || box.width < 20 || box.height < 20) {
      fail(`${label}: ${file} populated #cvText but editor has no usable layout`);
      return false;
    }
    pass(`${label}: ${file} populated CV editor (${Math.round(box.width)}x${Math.round(box.height)})`);
    info(`${label}: ${file} extracted ${value.length} characters`);
    return true;
  } catch (e) {
    fail(`${label}: ${file} did not populate #cvText: ${e.message}`);
    return false;
  }
}

async function audit(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...contextOptions, permissions: ['microphone'] });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));
  try {
    const response = await page.goto(base, { waitUntil: 'commit', timeout: 30000 });
    if (!response?.ok()) throw new Error(`home HTTP ${response?.status()}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!(await page.locator('body').innerText()).includes('GetJobReady')) throw new Error('branding missing');
    pass(`${name}: homepage loaded`);
    await verifyDeployment(page, name);

    await openModule(page, /CV Preparation|CV|resume|job match/i, 'CV');
    await settle(page);
    const input = page.locator('input[type=file]').first();
    if (!await input.count()) { fail(`${name}: CV upload input missing`); }
    else {
      for (const file of ['dummy-text.pdf', 'scanned-cv.pdf', 'dummy.docx', 'dummy.txt']) {
        if (await upload(page, file, `${name} CV`)) {
          await assertExtracted(page, file, `${name} CV`);
        }
      }
      const review = page.getByRole('button', { name: /Review & improve my CV/i }).first();
      if (await review.count() && await review.isVisible().catch(() => false)) {
        await review.click({ timeout: 12000 });
        await page.waitForTimeout(3000);
        pass(`${name}: CV review action exercised`);
      }
    }

    await page.goto(base, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await openModule(page, /AI Audio Interview|AI interviewer|voice interview|interview/i, 'Interview');
    await settle(page);
    const start = page.getByRole('button', { name: /start|begin|practice|ready/i }).first();
    if (await start.count() && await start.isVisible().catch(() => false)) {
      await start.click({ timeout: 12000 });
      await page.waitForTimeout(1200);
      pass(`${name}: interview started`);
    }
    if (consoleErrors.length) info(`${name}: console errors: ${consoleErrors.slice(0, 8).join(' | ')}`);
    if (pageErrors.length) fail(`${name}: page errors: ${pageErrors.slice(0, 8).join(' | ')}`);
  } catch (e) {
    fail(`${name}: fatal ${e.message}`);
  } finally {
    await browser.close();
  }
}

await audit('desktop', { viewport: { width: 1440, height: 900 } });
await audit('mobile', { ...devices['Pixel 7'] });

const report = { base, expectedSha: expectedSha || null, results, failures, generatedAt: new Date().toISOString() };
fs.writeFileSync('live-audit-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
