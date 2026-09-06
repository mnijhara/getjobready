import { chromium, devices } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

const PORT = 4199;
const server = spawn('node', ['server.cjs'], {
  cwd: '/Users/miteshnijhara/.gemini/antigravity/scratch/getjobready-app',
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'pipe'
});

server.stdout.on('data', d => console.log('[Server]', d.toString().trim()));
server.stderr.on('data', d => console.error('[Server Err]', d.toString().trim()));

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, res => {
        if (res.statusCode === 200) resolve();
        else setTimeout(() => check(n - 1), 300);
      });
      req.on('error', () => {
        if (n <= 0) reject(new Error('Server failed to start'));
        else setTimeout(() => check(n - 1), 300);
      });
    };
    check(retries);
  });
}

async function run() {
  try {
    await waitForServer(PORT);
    console.log('Server is healthy on port', PORT);

    const pixel7 = devices['Pixel 7'];
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ...pixel7,
      permissions: ['microphone']
    });
    const page = await context.newPage();
    page.on('console', msg => console.log('[Browser]', msg.text()));
    page.on('dialog', async d => { console.log('[Dialog]', d.message()); await d.accept(); });
    page.on('pageerror', err => console.error('[Page Err]', err));

    console.log('1. Navigating to mobile app...');
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });

    console.log('2. Entering workspace or dashboard...');
    const hasDashboard = await page.locator('.dashboard').isVisible().catch(() => false);
    if (!hasDashboard) {
      await page.click('button:has-text("Enter Workspace")');
      await page.fill('input[type="email"]', 'student-mobile@test.edu');
      await page.click('button:has-text("Continue")');
    }
    await page.waitForSelector('.dashboard');

    console.log('3. Opening Master CV preparation...');
    await page.locator('.master-cv-card, .pipe-step:has-text("Master CV")').first().click();
    await page.waitForSelector('#cvText');

    console.log('3. Filling CV text and clicking Review & improve my CV...');
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

    await page.focus('#cvText');
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

    const isBtnDisabled = await page.locator('button:has-text("Review & improve my CV")').getAttribute('disabled');
    console.log('Review button disabled status:', isBtnDisabled);

    await page.click('button:has-text("Review & improve my CV")');

    console.log('4. Waiting for CV Studio...');
    await page.waitForSelector('.studio');
    await page.waitForTimeout(400);

    const scrollYAtTop = await page.evaluate(() => window.scrollY);
    console.log('ScrollY at top of CV Studio:', scrollYAtTop);

    console.log('5. Locating Apply improvements button...');
    const applyBtn = page.locator('button.primary.wide:has-text("Apply")');
    await applyBtn.waitFor({ state: 'visible' });

    console.log('6. Clicking Apply improvements & preview...');
    await applyBtn.click();

    // Allow smooth scroll to settle
    await page.waitForTimeout(1000);

    const scrollYAfterApply = await page.evaluate(() => window.scrollY);
    console.log('ScrollY after clicking Apply:', scrollYAfterApply);

    if (scrollYAfterApply <= scrollYAtTop + 80) {
      throw new Error(`Expected page to scroll down, but scrollY was ${scrollYAfterApply}`);
    }
    console.log('✓ Page auto-scrolled down successfully!');

    const previewPanelInView = await page.evaluate(() => {
      const el = document.querySelector('.preview-panel');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    console.log('Preview panel in viewport:', previewPanelInView);
    if (!previewPanelInView) {
      throw new Error('Preview panel is not in viewport after clicking Apply!');
    }
    console.log('✓ Preview panel is clearly visible in viewport!');

    const badgeVisible = await page.locator('.applied-badge').isVisible();
    console.log('Applied badge visible:', badgeVisible);
    if (!badgeVisible) {
      throw new Error('Applied badge not visible!');
    }
    console.log('✓ Applied badge is visible!');

    console.log('7. Testing ↑ Suggestions jump button...');
    const suggBtn = page.locator('button:has-text("↑ Suggestions")');
    await suggBtn.waitFor({ state: 'visible' });
    await suggBtn.click();

    await page.waitForTimeout(1000);
    const scrollYAfterJumpUp = await page.evaluate(() => window.scrollY);
    console.log('ScrollY after jumping back to suggestions:', scrollYAfterJumpUp);

    if (scrollYAfterJumpUp >= scrollYAfterApply - 80) {
      throw new Error(`Expected page to scroll back up, but scrollY was ${scrollYAfterJumpUp}`);
    }
    console.log('✓ Successfully scrolled back up to suggestions!');

    console.log('8. Testing ✏️ Edit raw CV text button...');
    const editBtn = page.locator('button:has-text("Edit raw CV text")');
    await editBtn.click();
    await page.waitForTimeout(1000);

    const editPanelInView = await page.evaluate(() => {
      const el = document.querySelector('.edit-panel');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    console.log('Edit panel in viewport:', editPanelInView);
    if (!editPanelInView) {
      throw new Error('Edit panel is not in viewport after clicking Edit!');
    }
    console.log('✓ Edit panel auto-scrolled into viewport!');

    // Check that editText has been synchronized with the improvements
    const editTextContent = await page.locator('.edit-panel textarea').inputValue();
    console.log('Synced raw CV text length:', editTextContent.length);
    if (!editTextContent.includes('CORE COMPETENCIES')) {
      throw new Error('Expected editText to contain CORE COMPETENCIES from applied suggestions');
    }
    console.log('✓ Raw CV text synchronized with applied suggestions!');

    // Screenshot for artifact/proof
    await page.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/mobile_cvstudio_scrolled.png' });
    console.log('Screenshot saved to mobile_cvstudio_scrolled.png');

    await browser.close();
    console.log('\nALL MOBILE AUTO-SCROLL TESTS PASSED! 🎉');
  } finally {
    server.kill();
  }
}

run().catch(err => {
  console.error('TEST FAILED:', err);
  server.kill();
  process.exit(1);
});
