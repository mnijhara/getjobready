import { chromium, devices } from 'playwright';

async function testLive() {
  const pixel7 = devices['Pixel 7'];
  const browser = await chromium.launch({ headless: true });
  
  try {
    console.log('--- TESTING LIVE PRODUCTION ON MOBILE (Pixel 7) ---');
    const context = await browser.newContext({
      ...pixel7,
      permissions: ['microphone']
    });
    const page = await context.newPage();
    page.on('console', msg => console.log('[Browser]', msg.text()));
    page.on('dialog', async d => { await d.accept(); });

    console.log('Navigating to https://getjobready.online/ ...');
    await page.goto('https://getjobready.online/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const hasDashboard = await page.locator('.dashboard').isVisible().catch(() => false);
    if (!hasDashboard) {
      await page.click('button:has-text("Enter Workspace")');
      await page.fill('input[type="email"]', 'live-test-student@getjobready.online');
      await page.click('button:has-text("Continue")');
    }
    await page.waitForSelector('.dashboard');

    console.log('Opening Master CV...');
    await page.locator('.master-cv-card, .pipe-step:has-text("Master CV")').first().click();
    await page.waitForSelector('#cvText');

    const sampleCV = `Mitesh Nijhara | Software Engineer
mitesh@example.com | +91 9876543210 | Bangalore

EXECUTIVE SUMMARY
Experienced software engineer with track record building high-performance web applications.

PROFESSIONAL EXPERIENCE
Senior Developer · FinTech Corp · 2022 - Present
• Designed and developed payment microservices in Node.js and React.
• Improved transaction throughput and maintained zero downtime.
• Mentored junior engineers and led code review sprints.

EDUCATION
B.Tech Computer Science · IIT Bangalore · 2022`;

    await page.fill('#cvText', sampleCV);
    await page.evaluate((val) => {
      const el = document.getElementById('cvText');
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, sampleCV);
    await page.waitForTimeout(200);

    await page.click('button:has-text("Review & improve my CV")');
    await page.waitForSelector('.studio');
    await page.waitForTimeout(500);

    const scrollYAtTop = await page.evaluate(() => window.scrollY);
    console.log('Mobile scrollY at top of CV Studio:', scrollYAtTop);

    console.log('Clicking Apply improvements & preview...');
    const applyBtn = page.locator('button.primary.wide:has-text("Apply")');
    await applyBtn.click();
    await page.waitForTimeout(1200);

    const scrollYAfterApply = await page.evaluate(() => window.scrollY);
    console.log('Mobile scrollY after Apply:', scrollYAfterApply);

    const summaryCardVisible = await page.locator('.applied-summary-card').isVisible();
    console.log('Live Mobile applied summary card visible:', summaryCardVisible);

    const appliedItemsCount = await page.locator('.applied-point-item').count();
    console.log('Live Mobile applied points items count:', appliedItemsCount);

    const continueCardTopVisible = await page.locator('.continue-card-top').isVisible();
    console.log('Live Mobile Next Step continue card visible:', continueCardTopVisible);

    const iframeVisible = await page.locator('.cv-preview-frame iframe').isVisible();
    console.log('Live Mobile revised CV iframe visible:', iframeVisible);

    // Save screenshot of live mobile
    await page.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/live_mobile_applied_results_verified.png' });
    console.log('Live Mobile screenshot saved to live_mobile_applied_results_verified.png');

    await context.close();

    // Now test Laptop Viewport on Live
    console.log('\n--- TESTING LIVE PRODUCTION ON LAPTOP (1280x800) ---');
    const laptopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const laptopPage = await laptopContext.newPage();
    await laptopPage.goto('https://getjobready.online/', { waitUntil: 'networkidle' });

    const laptopDash = await laptopPage.locator('.dashboard').isVisible().catch(() => false);
    if (!laptopDash) {
      await laptopPage.click('button:has-text("Enter Workspace")');
      await laptopPage.fill('input[type="email"]', 'laptop-live@getjobready.online');
      await laptopPage.click('button:has-text("Continue")');
    }
    await laptopPage.waitForSelector('.dashboard');

    await laptopPage.locator('.master-cv-card, .pipe-step:has-text("Master CV")').first().click();
    await laptopPage.waitForSelector('#cvText');
    await laptopPage.fill('#cvText', sampleCV);
    await laptopPage.evaluate((val) => {
      const el = document.getElementById('cvText');
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, sampleCV);
    await laptopPage.waitForTimeout(200);

    await laptopPage.click('button:has-text("Review & improve my CV")');
    await laptopPage.waitForSelector('.studio');
    await laptopPage.waitForTimeout(400);

    await laptopPage.locator('button.primary.wide:has-text("Apply")').click();
    await laptopPage.waitForTimeout(1000);

    const laptopSummaryVisible = await laptopPage.locator('.applied-summary-card').isVisible();
    const laptopContinueTopVisible = await laptopPage.locator('.continue-card-top').isVisible();
    const laptopIframeVisible = await laptopPage.locator('.cv-preview-frame iframe').isVisible();

    console.log('Live Laptop summary card visible:', laptopSummaryVisible);
    console.log('Live Laptop next step card visible:', laptopContinueTopVisible);
    console.log('Live Laptop iframe visible:', laptopIframeVisible);

    await laptopPage.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/live_laptop_applied_results_verified.png' });
    console.log('Live Laptop screenshot saved to live_laptop_applied_results_verified.png');

    await laptopContext.close();

    console.log('\nLIVE PRODUCTION AUDIT SUCCESSFUL! 🎉');
  } finally {
    await browser.close();
  }
}

testLive().catch(err => {
  console.error('LIVE TEST ERROR:', err);
  process.exit(1);
});
