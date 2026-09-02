import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = 'https://getjobready.online/';
const results = [];
const failures = [];
const dummy = `Alex Student\nComputer Science Student | alex@example.com\nEducation: B.Tech Computer Science, Example University\nProjects: Built a campus placement tracker using React and Supabase.\nSkills: React, JavaScript, SQL, Python`;

function log(kind, msg) {
  results.push({ kind, msg });
  console.log(`[${kind}] ${msg}`);
}

async function auditDevice(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...contextOptions });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', async d => {
    log('dialog', `${name}: ${d.type()}: ${d.message()}`);
    await d.dismiss();
  });

  try {
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response || !response.ok()) throw new Error(`home HTTP ${response?.status()}`);
    await page.waitForTimeout(2500);
    log('pass', `${name}: homepage loaded`);

    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes('GetJobReady')) throw new Error('GetJobReady branding/content missing');

    const buttons = await page.locator('button:visible').allTextContents();
    log('info', `${name}: ${buttons.length} visible buttons`);
    const links = await page.locator('a:visible').evaluateAll(as => as.map(a => ({ text: (a.textContent || '').trim(), href: a.href })).slice(0, 100));
    log('info', `${name}: ${links.length} visible links`);

    const safeButtons = await page.locator('button:visible').evaluateAll(btns => btns.map((b, i) => ({
      i, text: (b.textContent || '').trim(), disabled: b.disabled
    })).filter(x => x.text && !x.disabled && !/(sign out|delete|remove|cancel|close|back|logout)/i.test(x.text)).slice(0, 30));

    for (const b of safeButtons) {
      try {
        const loc = page.locator('button:visible').nth(b.i);
        await loc.click({ timeout: 5000 });
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape').catch(() => {});
        log('pass', `${name}: clicked safe button "${b.text}"`);
      } catch (e) {
        failures.push(`${name}: button "${b.text}" failed: ${e.message}`);
      }
    }

    const cvText = page.getByText('CV Preparation', { exact: false }).first();
    if (await cvText.count()) {
      await cvText.click({ timeout: 10000 }).catch(async () => { await cvText.locator('..').click().catch(() => {}); });
      await page.waitForTimeout(1200);
    }

    const fileInputs = page.locator('input[type=file]');
    if (!(await fileInputs.count())) throw new Error('no file input found in CV flow');

    const tmp = process.env.GJR_AUDIT_FILES || '/tmp/gjr-audit';
    for (const filename of ['dummy-text.pdf', 'scanned-cv.pdf']) {
      const file = `${tmp}/${filename}`;
      if (!fs.existsSync(file)) throw new Error(`audit fixture missing: ${filename}`);
      await fileInputs.first().setInputFiles(file);
      await page.waitForTimeout(1800);
      log('pass', `${name}: uploaded ${filename}`);
    }

    const textarea = page.locator('textarea').first();
    if (await textarea.count()) {
      await textarea.fill(dummy);
      log('pass', `${name}: filled dummy CV text`);
    }

    const action = page.getByRole('button', { name: /analy[sz]e|improve|continue|match|generate report|save/i }).first();
    if (await action.count() && await action.isVisible()) {
      await action.click({ timeout: 10000 }).catch(e => failures.push(`${name}: CV report/action failed: ${e.message}`));
      await page.waitForTimeout(3000);
      log('pass', `${name}: CV report/action exercised`);
    }

    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    const interview = page.getByText('AI Audio Interview', { exact: false }).first();
    if (await interview.count()) {
      await interview.click({ timeout: 10000 }).catch(async () => { await interview.locator('..').click().catch(() => {}); });
      await page.waitForTimeout(1200);
      const inputs = page.locator('input:visible, textarea:visible');
      for (let i = 0; i < await inputs.count(); i++) {
        const el = inputs.nth(i);
        const type = (await el.getAttribute('type')) || 'text';
        if (type !== 'file') await el.fill(type === 'email' ? 'audit@example.com' : dummy.slice(0, 120)).catch(() => {});
      }
      const start = page.getByRole('button', { name: /start|begin|practice|interview|continue/i }).first();
      if (await start.count() && await start.isVisible()) {
        await start.click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1500);
        log('pass', `${name}: interview start/control exercised`);
      }
    }

    if (consoleErrors.length) log('warn', `${name}: ${consoleErrors.length} console errors`);
    if (pageErrors.length) failures.push(`${name}: ${pageErrors.length} page errors: ${pageErrors.slice(0, 5).join(' | ')}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  } finally {
    await browser.close();
  }
}

await auditDevice('desktop', { viewport: { width: 1440, height: 900 } });
await auditDevice('mobile', { ...devices['Pixel 7'] });

const report = { results, failures, generatedAt: new Date().toISOString() };
fs.writeFileSync('live-audit-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
