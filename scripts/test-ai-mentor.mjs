import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const TARGET_URL = process.env.TARGET_URL ? process.env.TARGET_URL.replace(/\/$/, '') + '/' : '';
const PORT = 4192;
const BASE = TARGET_URL || `http://127.0.0.1:${PORT}/`;

async function main() {
  let server = null;
  if (!TARGET_URL) {
    console.log('--- Starting local server for AI Mentor & Free Courses Test ---');
    server = spawn(process.execPath, ['server.cjs'], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
      stdio: 'inherit'
    });

    // Wait for server to start
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
        if (res.ok) break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } else {
    console.log(`--- Testing against remote TARGET_URL: ${TARGET_URL} ---`);
  }

  try {
    if (!TARGET_URL) {
      console.log('--- Running direct API test on /api/aimentor ---');
      const apiRes = await fetch(`${BASE}api/aimentor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          career: 'Product Manager',
          message: 'How do I draft an executive memo with Claude using SCQA?',
          messages: [
            { role: 'user', content: 'How do I draft an executive memo with Claude using SCQA?' }
          ]
        })
      });

      if (!apiRes.ok) {
        throw new Error(`API test failed with status ${apiRes.status}: ${await apiRes.text()}`);
      }

      const apiData = await apiRes.json();
      console.log('API Response received:');
      console.log('Reply preview:', apiData.reply?.slice(0, 100) + '...');
      console.log('Recommended Prompt preview:', apiData.recommendedPrompt?.slice(0, 80) + '...');
      console.log('Key takeaways count:', apiData.keyTakeaways?.length);
      console.log('Recommended Course:', apiData.recommendedCourse);
      if (!apiData.reply || !apiData.recommendedPrompt || !apiData.keyTakeaways) {
        throw new Error('API payload missing critical fields: ' + JSON.stringify(apiData));
      }
      console.log('✓ /api/aimentor direct API test passed.');
    } else {
      console.log('Testing against remote target URL. Verifying endpoint or resilient fallback in browser.');
    }

    console.log('--- Launching Playwright browser ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log(`Navigating to ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Enter workspace if auth / welcome screen is visible
    const enterBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('aimentor_tester@example.com');
        await page.getByRole('button', { name: /Continue/i }).click();
        await page.waitForTimeout(1000);
      }
    }

    console.log('Navigating to AI at Work module...');
    const aiStep = page.locator('button:has-text("AI at Work"), .journey-step:has-text("AI at Work")').first();
    await aiStep.waitFor({ state: 'visible', timeout: 10000 });
    await aiStep.click();
    await page.waitForTimeout(1000);

    // Verify Title
    const title = page.locator('h2:has-text("AI at Work: Practical Workflows, Live Mentor & Free Courses")').first();
    await title.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Heading confirmed: AI at Work: Practical Workflows, Live Mentor & Free Courses');

    // Verify 3 tabs
    const tab1 = page.getByRole('tab', { name: /AI Workplace Mentor & Live Chat/i });
    const tab2 = page.getByRole('tab', { name: /Battle-Tested Prompts & 7-Day Sprint/i });
    const tab3 = page.getByRole('tab', { name: /Free AI Courses & Certifications/i });
    await tab1.waitFor({ state: 'visible' });
    await tab2.waitFor({ state: 'visible' });
    await tab3.waitFor({ state: 'visible' });
    console.log('✓ All 3 navigation tabs confirmed visible');

    // Verify Alex Rivera mentor header
    const mentorName = page.locator('h4:has-text("Alex Rivera")');
    await mentorName.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Mentor profile confirmed: Alex Rivera');

    // Verify initial mentor greeting
    const initialMsg = page.locator('.chat-msg.character .chat-bubble').first();
    await initialMsg.waitFor({ state: 'visible' });
    console.log('✓ Initial greeting verified:', (await initialMsg.innerText()).slice(0, 80) + '...');

    // Test sending message in Chat
    console.log('Testing sending a question to Alex Rivera...');
    const inputBox = page.locator('.chat-input-box');
    await inputBox.fill('How do I structure an AI prompt to summarize messy client interview transcripts into key pain points?');
    const sendBtn = page.locator('.chat-send-btn');
    await sendBtn.click();

    // Wait for mentor response and mentor guidance card
    console.log('Waiting for mentor response and guidance blueprint card...');
    const guidanceCard = page.locator('.mentor-guidance-card');
    await guidanceCard.waitFor({ state: 'visible', timeout: 35000 });
    console.log('✓ Enterprise Mentor Action Blueprint card rendered!');

    const guidanceHeader = await page.locator('.mentor-guidance-header').innerText();
    console.log('✓ Guidance Blueprint:', guidanceHeader);

    const prefix = TARGET_URL ? 'live-ai-' : 'ai-';

    // Take Tab 1 Screenshot
    await guidanceCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/${prefix}tab1-mentor-chat.png`, fullPage: true });
    console.log(`✓ Saved Tab 1 screenshot: ${prefix}tab1-mentor-chat.png`);

    // Verify Tab 2: Battle-Tested Prompts & 7-Day Sprint
    console.log('Switching to Tab 2 (Battle-Tested Prompts & 7-Day Sprint)...');
    await tab2.click();
    await page.waitForTimeout(500);

    const promptsHeading = page.locator('h3:has-text("5 Battle-Tested Copyable AI Prompts")');
    await promptsHeading.waitFor({ state: 'visible' });
    const guardrailsHeading = page.locator('span:has-text("Responsible AI Guardrails Checklist")');
    await guardrailsHeading.waitFor({ state: 'visible' });
    const sprintHeading = page.locator('h3:has-text("Build Your Tailored 7-Day AI Sprint")');
    await sprintHeading.waitFor({ state: 'visible' });
    console.log('✓ Prompts, Guardrails, and Sprint builder confirmed in Tab 2');

    await page.screenshot({ path: `/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/${prefix}tab2-prompts-sprint.png`, fullPage: true });
    console.log(`✓ Saved Tab 2 screenshot: ${prefix}tab2-prompts-sprint.png`);

    // Test "Discuss in Chat" button on Prompt 1
    console.log('Testing "Discuss in Chat" from Tab 2...');
    const discussBtn = page.locator('button:has-text("Discuss in Chat")').first();
    await discussBtn.click();
    await page.waitForTimeout(1000);

    // Verify Tab 1 is now active again
    const isTab1Active = await tab1.getAttribute('aria-selected');
    if (isTab1Active !== 'true') {
      throw new Error('"Discuss in Chat" did not switch back to active tab 1');
    }
    console.log('✓ "Discuss in Chat" seamlessly switched to Tab 1 and submitted discussion prompt!');

    // Verify Tab 3: Free AI Courses & Certifications
    console.log('Switching to Tab 3 (Free AI Courses & Certifications)...');
    await tab3.click();
    await page.waitForTimeout(500);

    const coursesHeading = page.locator('h3:has-text("Verified 100% Free AI Courses & Certifications")');
    await coursesHeading.waitFor({ state: 'visible' });

    // Verify all 6 courses
    const deeplearning = page.locator('.course-card:has-text("DeepLearning.AI")');
    const microsoft = page.locator('.course-card:has-text("Microsoft & LinkedIn")');
    const vanderbilt = page.locator('.course-card:has-text("Vanderbilt University")');
    const google = page.locator('.course-card:has-text("Google Cloud")');
    const harvard = page.locator('.course-card:has-text("Harvard University")');
    const ibm = page.locator('.course-card:has-text("IBM")');

    await deeplearning.waitFor({ state: 'visible' });
    await microsoft.waitFor({ state: 'visible' });
    await vanderbilt.waitFor({ state: 'visible' });
    await google.waitFor({ state: 'visible' });
    await harvard.waitFor({ state: 'visible' });
    await ibm.waitFor({ state: 'visible' });
    console.log('✓ All 6 verified free AI courses confirmed visible (DeepLearning.AI, Microsoft, Vanderbilt, Google Cloud, Harvard, IBM)');

    await page.screenshot({ path: `/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/${prefix}tab3-free-courses.png`, fullPage: true });
    console.log(`✓ Saved Tab 3 screenshot: ${prefix}tab3-free-courses.png`);

    await browser.close();
    console.log('🎉 ALL AI AT WORK LIVE MENTOR & FREE COURSES TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
