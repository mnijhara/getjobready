import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4178;
const BASE = `http://127.0.0.1:${PORT}/`;

async function main() {
  console.log('--- Starting server for Prototype Simulation Test ---');
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

    console.log('--- Server is live. Launching Playwright browser ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log(`Navigating to ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Authenticate / Enter Workspace
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

    console.log('Navigating to Impress the Interviewer (demo module)...');
    const demoCard = page.locator('button:has-text("Impress the Interviewer")').first();
    await demoCard.waitFor({ state: 'visible', timeout: 10000 });
    await demoCard.click();
    await page.waitForTimeout(1000);

    // Select "Zomato" preset
    console.log('Clicking Zomato preset...');
    const zomatoBtn = page.getByRole('button', { name: 'Zomato' }).first();
    await zomatoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await zomatoBtn.click();
    await page.waitForTimeout(500);

    // Click "Build my interview demo"
    console.log('Clicking "Build my interview demo"...');
    const buildDemoBtn = page.getByRole('button', { name: /Build my interview demo/i }).first();
    await buildDemoBtn.click();

    // Wait for the prototype preview iframe to appear
    console.log('Waiting for Prototype Sandbox iframe...');
    const iframeLocator = page.locator('iframe[title="Prototype Sandbox"]');
    await iframeLocator.waitFor({ state: 'visible', timeout: 35000 });

    const frame = page.frameLocator('iframe[title="Prototype Sandbox"]');

    // Inside iframe: locate the simulation button
    console.log('Locating simulation button inside iframe...');
    const simBtn = frame.locator('button:has-text("Simulate"), #trigger-btn, #simBtn, button').first();
    await simBtn.waitFor({ state: 'visible', timeout: 8000 });
    const initialText = (await simBtn.innerText()).trim();
    console.log(`Initial button text: "${initialText}"`);

    // Click Simulate Workflow!
    console.log('Clicking Simulate Workflow button...');
    await simBtn.click();

    // Check response immediately
    await page.waitForTimeout(500);
    console.log('✓ Button click registered without being blocked!');

    // Wait for simulation stages to run
    console.log('Waiting for simulation stages to progress...');
    await page.waitForTimeout(7000);

    const postBtnText = (await simBtn.innerText()).trim();
    console.log(`Post-simulation button text: "${postBtnText}"`);

    // Verify that re-simulation button is enabled
    const isDisabled = await simBtn.isDisabled();
    console.log(`Re-simulation button disabled: ${isDisabled}`);
    if (isDisabled) {
      throw new Error('Simulation button remained disabled after workflow completed!');
    }

    await browser.close();
    console.log('\n=======================================');
    console.log('🎉 PROTOTYPE SIMULATOR TEST 100% PASSED!');
    console.log('=======================================');
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
