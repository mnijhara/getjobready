import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4178;
const BASE = `http://127.0.0.1:${PORT}`;

async function main() {
  console.log('=== Verifying Scroll-to-Top Behavior on Screen Navigation ===');
  
  // Start server
  const server = spawn('node', ['server.cjs'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  await new Promise(res => setTimeout(res, 1200));

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    console.log(`1. Navigating to ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Test 1: Home page scroll down to Stage 2 and click Corporate Ready
    console.log('2. Scrolling down on Home page to Stage 2 cards...');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(200);

    let scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   Current scrollY before click: ${scrollY}`);
    if (scrollY < 400) {
      throw new Error(`Expected page to be scrolled down, but scrollY was ${scrollY}`);
    }

    console.log('3. Clicking "Corporate Ready" module card...');
    const corporateCard = page.locator('.module-card:has-text("Corporate Ready")').first();
    await corporateCard.click();
    await page.waitForTimeout(300);

    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY after navigating to Corporate Ready: ${scrollY}`);
    if (scrollY !== 0) {
      throw new Error(`FAIL: Viewport did not scroll to top! scrollY=${scrollY}`);
    }
    console.log('   PASS: Corporate Ready screen started at top (scrollY = 0)');

    // Verify top header is visible
    const prepEyebrow = page.locator('text=YOUR PREPARATION').first();
    await prepEyebrow.waitFor({ state: 'visible', timeout: 5000 });
    console.log('   PASS: "YOUR PREPARATION" header is visible at top');

    // Test 2: Click Back button
    console.log('4. Scrolling down inside Corporate Ready...');
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(100);
    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY before clicking Back: ${scrollY}`);

    console.log('5. Clicking "← Back" button...');
    await page.locator('button.back').click();
    await page.waitForTimeout(300);

    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY after clicking Back to Home: ${scrollY}`);
    if (scrollY !== 0) {
      throw new Error(`FAIL: Home did not start at top! scrollY=${scrollY}`);
    }
    console.log('   PASS: Home screen started at top (scrollY = 0)');

    // Test 3: Log in to Workspace, scroll down, click Impress the Interviewer
    console.log('6. Entering Workspace / Dashboard...');
    const enterBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
    await enterBtn.click();
    await page.waitForTimeout(300);
    await page.locator('input[type="email"]').fill('scroll.test@example.com');
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(600);

    console.log('7. Scrolling down in Dashboard...');
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(100);
    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY in Dashboard before click: ${scrollY}`);

    console.log('8. Clicking Impress the Interviewer from Dashboard...');
    const demoBtn = page.locator('button:has-text("Impress the Interviewer")').first();
    await demoBtn.click();
    await page.waitForTimeout(300);

    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY after clicking Impress the Interviewer: ${scrollY}`);
    if (scrollY !== 0) {
      throw new Error(`FAIL: Demo screen did not start at top! scrollY=${scrollY}`);
    }
    console.log('   PASS: Impress the Interviewer started at top (scrollY = 0)');

    // Test 4: Clicking Brand Logo to go Home
    console.log('9. Scrolling down in Demo screen and clicking brand logo...');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);
    await page.locator('.brand').click();
    await page.waitForTimeout(300);

    scrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    console.log(`   ScrollY after clicking brand logo: ${scrollY}`);
    if (scrollY !== 0) {
      throw new Error(`FAIL: Page did not reset to top on brand logo click! scrollY=${scrollY}`);
    }
    console.log('   PASS: Brand logo reset view to top (scrollY = 0)');

    console.log('\n=== ALL SCROLL-TO-TOP TESTS PASSED PERFECTLY ===');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
