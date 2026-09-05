import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4189;
const BASE = `http://127.0.0.1:${PORT}/`;

async function main() {
  console.log('--- Starting server for Role-Play Chatbot & Free Courses Test ---');
  const server = spawn(process.execPath, ['server.cjs'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  try {
    // Wait for server to start
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
        if (res.ok) break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log('--- Server is live. Running direct API test on /api/roleplay ---');
    const apiRes = await fetch(`http://127.0.0.1:${PORT}/api/roleplay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioId: 'critical-feedback',
        scenarioName: 'Critical Manager Feedback',
        persona: 'Vikram Mehta (Director of Operations)',
        messages: [
          { role: 'assistant', content: "I just reviewed the draft you submitted. Honestly, this isn't anywhere near executive-ready." },
          { role: 'user', content: "Thank you for the direct feedback. I will adjust the methodology immediately and send you a revised draft by 4 PM." }
        ],
        candidateMessage: "Thank you for the direct feedback. I will adjust the methodology immediately and send you a revised draft by 4 PM.",
        career: 'Consultant'
      })
    });

    if (!apiRes.ok) {
      throw new Error(`API test failed with status ${apiRes.status}: ${await apiRes.text()}`);
    }

    const apiData = await apiRes.json();
    console.log('API Response received:');
    console.log('Reply:', apiData.reply?.slice(0, 100) + '...');
    console.log('Coaching score:', apiData.coaching?.score, 'Resilience:', apiData.coaching?.resilienceScore);
    if (!apiData.reply || !apiData.coaching?.score || !apiData.coaching?.executiveScript) {
      throw new Error('API payload missing critical fields: ' + JSON.stringify(apiData));
    }
    console.log('✓ /api/roleplay direct API test passed.');

    console.log('--- Launching Playwright browser ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log(`Navigating to ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Enter workspace
    const enterBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('tester@example.com');
        await page.getByRole('button', { name: /Continue/i }).click();
        await page.waitForTimeout(1000);
      }
    }

    console.log('Navigating to Corporate Ready module...');
    const readinessCard = page.locator('button:has-text("Corporate Ready"), button:has-text("Feedback Resilience")').first();
    await readinessCard.waitFor({ state: 'visible', timeout: 10000 });
    await readinessCard.click();
    await page.waitForTimeout(1000);

    // Verify Title
    const title = await page.locator('h2:has-text("Corporate Ready, Live Role-Play")').first();
    await title.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Heading confirmed: Corporate Ready, Live Role-Play & Feedback Resilience');

    // Verify 3 tabs
    const tab1 = page.getByRole('tab', { name: /Live Role-Play Simulator/i });
    const tab2 = page.getByRole('tab', { name: /Resilience Playbooks/i });
    const tab3 = page.getByRole('tab', { name: /Free University Courses/i });
    await tab1.waitFor({ state: 'visible' });
    await tab2.waitFor({ state: 'visible' });
    await tab3.waitFor({ state: 'visible' });
    console.log('✓ All 3 navigation tabs confirmed visible');

    // Verify initial Vikram persona message
    const initialBubble = page.locator('.chat-msg.character .chat-bubble').first();
    await initialBubble.waitFor({ state: 'visible', timeout: 5000 });
    const text = await initialBubble.innerText();
    console.log('✓ Initial Persona Message:', text.slice(0, 80) + '...');

    // Switch scenario to Sarah Chen
    console.log('Testing scenario switch to Sarah Chen...');
    const sarahBtn = page.getByRole('button', { name: /Sarah Chen/i });
    await sarahBtn.click();
    await page.waitForTimeout(500);
    const sarahBubble = page.locator('.chat-msg.character .chat-bubble').first();
    const sarahText = await sarahBubble.innerText();
    if (!sarahText.includes('competitor benchmark')) {
      throw new Error('Sarah Chen scenario did not activate properly');
    }
    console.log('✓ Scenario switch to Sarah Chen verified');

    // Switch back to Vikram Mehta
    const vikramBtn = page.getByRole('button', { name: /Critical Manager Feedback/i });
    await vikramBtn.click();
    await page.waitForTimeout(500);

    // Test sending message
    console.log('Typing student response...');
    const inputBox = page.locator('.chat-input-box');
    await inputBox.fill('Thank you for pointing that out clearly. I will recalibrate the assumptions and deliver an updated draft by 4 PM.');
    const sendBtn = page.locator('.chat-send-btn');
    await sendBtn.click();

    // Wait for response and coaching card
    console.log('Waiting for AI response & coaching card...');
    const coachingCard = page.locator('.coaching-card');
    await coachingCard.waitFor({ state: 'visible', timeout: 35000 });
    console.log('✓ Instant Resilience Coaching card appeared!');

    const coachingTitle = await page.locator('.coaching-title').innerText();
    const scoreText = await page.locator('.coach-score-badge').first().innerText();
    console.log(`✓ Coaching Header: ${coachingTitle} | Score: ${scoreText}`);

    // Verify Tab 2: Resilience Playbooks
    console.log('Switching to Resilience Playbooks tab...');
    await tab2.click();
    await page.waitForTimeout(500);
    const abcdModel = page.locator('h3:has-text("The ABCD Model of Workplace Resilience")');
    await abcdModel.waitFor({ state: 'visible' });
    const rules = page.locator('h3:has-text("The 3 Golden Rules of Executive Composure")');
    await rules.waitFor({ state: 'visible' });
    console.log('✓ ABCD Model and 3 Golden Rules verified in Playbooks tab');
    await page.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/tab2-playbooks.png', fullPage: true });

    // Verify Tab 3: Free University Courses Hub
    console.log('Switching to Free University Courses tab...');
    await tab3.click();
    await page.waitForTimeout(500);
    const coursesTitle = page.locator('h3:has-text("Verified 100% Free Online Courses")');
    await coursesTitle.waitFor({ state: 'visible' });

    const upennCard = page.locator('.course-card:has-text("Wharton")');
    const yaleCard = page.locator('.course-card:has-text("Yale")');
    const umichCard = page.locator('.course-card:has-text("Michigan")');
    await upennCard.waitFor({ state: 'visible' });
    await yaleCard.waitFor({ state: 'visible' });
    await umichCard.waitFor({ state: 'visible' });
    console.log('✓ Wharton, Yale, and Michigan verified free courses verified');
    await page.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/tab3-courses.png', fullPage: true });

    // Switch back to Roleplay tab and scroll to coaching card
    await tab1.click();
    await page.waitForTimeout(500);
    await coachingCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/Users/miteshnijhara/.gemini/antigravity/brain/f4d493be-bd40-4f55-90e0-bdfa6e7a8246/tab1-roleplay-coaching.png', fullPage: true });
    console.log('✓ All 3 tab screenshots saved to artifacts directory.');

    await browser.close();
    console.log('🎉 ALL ROLEPLAY CHATBOT & FREE COURSES TESTS PASSED!');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
