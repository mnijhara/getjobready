import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const PORT = 4195;
const BASE = `http://127.0.0.1:${PORT}/`;
const SUPABASE_URL = 'https://lgctkqqgtpnabydukypt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mKG4Ylo2tyeMQMT0CopVXQ_a_icNi20';
const TEST_EMAIL = 'mnijhara_test@gmail.com';

const emailToUuid = (email) => {
  const clean = email.toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (Math.imul(31, h) + clean.charCodeAt(i)) | 0;
  }
  const s = Math.abs(h).toString(16).padStart(8, '0');
  const s2 = Math.abs(Math.imul(h, 37)).toString(16).padStart(12, '0');
  return `${s}-0000-4000-8000-${s2}`;
};

const TEST_UID = emailToUuid(TEST_EMAIL);

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`--- Cleaning up any prior test rows for ${TEST_EMAIL} (UID: ${TEST_UID}) ---`);
  await supabase.from('interviews').delete().eq('user_id', TEST_UID);
  await supabase.from('job_applications').delete().eq('user_id', TEST_UID);
  await supabase.from('master_cvs').delete().eq('user_id', TEST_UID);
  await supabase.from('profiles').delete().eq('id', TEST_UID);

  console.log('--- Starting local server for Supabase Sync Test ---');
  const server = spawn(process.execPath, ['server.cjs'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  try {
    const browser = await chromium.launch({ headless: true });

    // ─── 1. SIMULATE LAPTOP (Context 1) ───
    console.log('--- Step 1: Simulating Laptop ---');
    const laptopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const laptopPage = await laptopContext.newPage();

    await laptopPage.goto(BASE, { waitUntil: 'domcontentloaded' });
    await laptopPage.waitForTimeout(500);

    // Login as TEST_EMAIL
    const enterBtn = laptopPage.getByRole('button', { name: /Enter Workspace/i }).first();
    await enterBtn.click();
    await laptopPage.waitForTimeout(500);
    const emailInput = laptopPage.locator('input[type="email"]');
    await emailInput.fill(TEST_EMAIL);
    await laptopPage.getByRole('button', { name: /Continue/i }).click();
    await laptopPage.waitForTimeout(1000);

    // Verify workspace loaded
    await laptopPage.locator('h2:has-text("Welcome back")').waitFor({ state: 'visible' });
    console.log('✓ Laptop logged in and workspace active');

    // Add 2 Cars24 interview records via db on Laptop
    console.log('Saving 2 Cars24 interview records on Laptop...');
    await laptopPage.evaluate((email) => {
      window.db.saveInterview({
        role: 'Cars24 · Associate',
        score: 8,
        date: new Date('2026-09-05T10:00:00.000Z').toISOString(),
        strengths: ['Analytical structure'],
        improvements: ['STAR clarity'],
        nextAction: 'Practise again',
        answers: [{ question: 'Tell me about yourself', answer: 'Worked at Cars24', evaluation: { score: 8 } }]
      });
      window.db.saveInterview({
        role: 'Cars24 · Strategy Intern',
        score: 3,
        date: new Date('2026-09-05T11:00:00.000Z').toISOString(),
        strengths: ['Good attitude'],
        improvements: ['More metrics needed'],
        nextAction: 'Practise again',
        answers: [{ question: 'Why Cars24?', answer: 'Auto tech sector leader', evaluation: { score: 3 } }]
      });
      return window.db.syncFromCloud();
    }, TEST_EMAIL);

    await laptopPage.waitForTimeout(1500);

    // Check Supabase directly
    const { data: cloudIvs1 } = await supabase.from('interviews').select('*').eq('user_id', TEST_UID);
    console.log(`Supabase interviews count after laptop sync: ${cloudIvs1?.length}`);
    if (!cloudIvs1 || cloudIvs1.length !== 2) {
      throw new Error(`Expected 2 interviews in Supabase, got ${cloudIvs1?.length}`);
    }
    console.log('✓ Both Cars24 interviews successfully uploaded to Supabase from Laptop!');

    // ─── 2. SIMULATE MOBILE (Context 2 - completely isolated storage) ───
    console.log('--- Step 2: Simulating Mobile (Separate Device / Browser Context) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('console', msg => console.log('MOBILE CONSOLE:', msg.text()));
    mobilePage.on('pageerror', err => console.log('MOBILE PAGE ERROR:', err));

    await mobilePage.goto(BASE, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(500);

    // Login on Mobile as TEST_EMAIL
    const mobileEnterBtn = mobilePage.getByRole('button', { name: /Enter Workspace/i }).first();
    await mobileEnterBtn.click();
    await mobilePage.waitForTimeout(500);
    const mobileEmailInput = mobilePage.locator('input[type="email"]');
    await mobileEmailInput.fill(TEST_EMAIL);
    await mobilePage.getByRole('button', { name: /Continue/i }).click();
    await mobilePage.waitForTimeout(1500);

    console.log('Explicitly triggering db.syncFromCloud() on Mobile...');
    const syncRes = await mobilePage.evaluate(async () => {
      try {
        console.log('Calling window.db.syncFromCloud()...');
        const res = await window.db.syncFromCloud();
        console.log('window.db.syncFromCloud() returned:', res);
        return { success: true, res, interviews: window.db.getInterviews() };
      } catch (err) {
        console.error('window.db.syncFromCloud() error:', err?.message || err);
        return { success: false, error: err?.message || String(err) };
      }
    });
    console.log('Mobile sync evaluated result:', syncRes);
    await mobilePage.waitForTimeout(1000);

    // Switch to Interview History tab on Mobile
    const ivTabMobile = mobilePage.getByRole('button', { name: /Interview History/i });
    await ivTabMobile.click();
    await mobilePage.waitForTimeout(1000);

    const mobileStorage = await mobilePage.evaluate(() => {
      const keys = Object.keys(localStorage);
      const res = {};
      for (const k of keys) res[k] = localStorage.getItem(k);
      return res;
    });
    console.log('Mobile localStorage keys:', Object.keys(mobileStorage));

    // Verify Mobile downloaded both Cars24 interviews from Supabase!
    const carsCards = mobilePage.locator('.history-card:has-text("Cars24")');
    const countOnMobile = await carsCards.count();
    console.log(`Cars24 interviews visible on Mobile: ${countOnMobile}`);
    if (countOnMobile !== 2) {
      console.log('Mobile inner HTML of workspace:', await mobilePage.locator('.dashboard').innerHTML());
      throw new Error(`Expected Mobile to download 2 Cars24 interviews, but saw ${countOnMobile}`);
    }
    console.log('✓ Mobile successfully downloaded and rendered both Cars24 interviews from Supabase cloud!');

    // Now save a Google interview on Mobile
    console.log('Saving Google interview on Mobile...');
    await mobilePage.evaluate(() => {
      window.db.saveInterview({
        role: 'Google – Software Engineer',
        score: 7,
        date: new Date('2026-09-05T14:00:00.000Z').toISOString(),
        strengths: ['Strong technical grounding'],
        improvements: ['System design depth'],
        nextAction: 'Review Model Answers',
        answers: [{ question: 'Walk me through a project', answer: 'Built distributed cache', evaluation: { score: 7 } }]
      });
      return window.db.syncFromCloud();
    });

    await mobilePage.waitForTimeout(1500);

    // Check Supabase directly
    const { data: cloudIvs2 } = await supabase.from('interviews').select('*').eq('user_id', TEST_UID);
    console.log(`Supabase interviews count after mobile sync: ${cloudIvs2?.length}`);
    if (!cloudIvs2 || cloudIvs2.length !== 3) {
      throw new Error(`Expected 3 interviews in Supabase (2 Cars24 + 1 Google), got ${cloudIvs2?.length}`);
    }
    console.log('✓ Google interview successfully uploaded to Supabase from Mobile!');

    // ─── 3. VERIFY LAPTOP RECEIVES MOBILE'S GOOGLE INTERVIEW ON FOCUS ───
    console.log('--- Step 3: Verifying Laptop Receives Mobile Updates ---');
    await laptopPage.bringToFront();
    await laptopPage.evaluate(() => window.db.syncFromCloud());
    await laptopPage.waitForTimeout(1500);

    // Switch to Interview History tab on Laptop
    const ivTabLaptop = laptopPage.getByRole('button', { name: /Interview History/i });
    await ivTabLaptop.click();
    await laptopPage.waitForTimeout(500);

    const totalOnLaptop = await laptopPage.locator('.history-card').count();
    console.log(`Total interviews visible on Laptop: ${totalOnLaptop}`);
    const googleOnLaptop = await laptopPage.locator('.history-card:has-text("Google")').count();
    console.log(`Google interviews visible on Laptop: ${googleOnLaptop}`);

    if (totalOnLaptop !== 3 || googleOnLaptop !== 1) {
      throw new Error(`Expected Laptop to display 3 total interviews with 1 Google, got total ${totalOnLaptop}`);
    }
    console.log('✓ Laptop successfully synchronized Google interview from Mobile via Supabase!');

    await browser.close();

    // Clean up test rows
    console.log('--- Cleaning up test rows in Supabase ---');
    await supabase.from('interviews').delete().eq('user_id', TEST_UID);
    await supabase.from('job_applications').delete().eq('user_id', TEST_UID);
    await supabase.from('master_cvs').delete().eq('user_id', TEST_UID);
    await supabase.from('profiles').delete().eq('id', TEST_UID);
    console.log('✓ Supabase test rows cleaned.');

    console.log('🎉 SUPABASE CROSS-DEVICE SYNC TEST PASSED COMPLETELY!');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
