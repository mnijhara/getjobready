import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 4196;
const LOCAL_BASE = `http://127.0.0.1:${PORT}/`;
const LIVE_BASE = process.env.TARGET_URL || 'https://getjobready.online/';
const SCREENSHOT_DIR = path.resolve('scratch/audit-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sampleCV = `
Priya Sharma
Email: priya.sharma@example.edu | Phone: +91 98765 43210 | Bangalore, India
LinkedIn: linkedin.com/in/priyasharma

EDUCATION
MBA (General Management & Strategy) | Indian Institute of Management, Bangalore (2023 - 2025)
B.Tech in Computer Science | National Institute of Technology, Trichy | CGPA: 8.9/10 (2018 - 2022)

PROFESSIONAL EXPERIENCE & INTERNSHIPS
Strategy Intern | Cars24 (Apr 2024 - Jun 2024)
- Designed a machine learning dealer appraisal pricing model across 14 Tier-1 and Tier-2 Indian hubs.
- Analyzed 45,000+ car inspection transactions to reduce inspection turnaround time by 28%.
- Synthesized insights into weekly executive dashboards for Chief Business Officer and VP Operations.

Senior Associate Consultant | Deloitte USI (Jul 2022 - Jun 2023)
- Built automated financial reconciliation pipelines for a Fortune 100 retail client in SAP & Python.
- Spearheaded stakeholder interviews across 4 departments, identifying $420,000 in annual leakage.

KEY PROJECTS
- Hyperlocal Inventory Optimizer: Built heuristic demand forecast tool for quick-commerce delivery.
- Customer Churn Predictive Modeling: Led 4-member team to build XGBoost classifier with 84% ROC-AUC.
`.trim();

const sampleJD = `
Management Consulting Associate / Business Analyst
Company: McKinsey & Company / Client Experience
Location: Gurgaon / Mumbai, India

Key Responsibilities:
- Structure ambiguous business challenges into analytical problem trees.
- Formulate data-driven hypotheses and test them using client transactional datasets and market interviews.
- Communicate complex findings with clarity and poise to C-suite and senior operational stakeholders.
- Deliver workstreams under tight timelines with high attention to detail and zero defects.

Requirements:
- Strong quantitative and problem-solving skills; proficiency in Excel, Python, or SQL.
- Exceptional executive communication, structured thinking, and business presence.
- Demonstrated leadership, teamwork, and ability to handle executive critique constructively.
`.trim();

async function runStudentAudit(baseUrl, isLive = false) {
  const label = isLive ? 'LIVE PRODUCTION' : 'LOCAL PRODUCTION';
  const prefix = isLive ? 'live' : 'local';
  console.log(`\n======================================================`);
  console.log(`🚀 STARTING COMPLETE STUDENT JOURNEY AUDIT ON: ${label} (${baseUrl})`);
  console.log(`======================================================\n`);

  const report = {
    target: baseUrl,
    environment: label,
    startedAt: new Date().toISOString(),
    steps: [],
    screenshots: [],
    errors: [],
    warnings: [],
    passed: true
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('analytics') && !text.includes('gtag')) {
        console.warn(`⚠️ [Browser Console Error]:`, text);
        report.warnings.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    console.error(`❌ [Page Exception]:`, err.message);
    report.errors.push(err.message);
    report.passed = false;
  });

  async function step(name, fn) {
    const start = Date.now();
    try {
      console.log(`▶ [STEP] ${name}...`);
      await fn();
      const dur = Date.now() - start;
      console.log(`  ✓ PASSED: ${name} (${dur}ms)`);
      report.steps.push({ name, status: 'PASS', durationMs: dur });
    } catch (err) {
      const dur = Date.now() - start;
      console.error(`  ✗ FAILED: ${name} (${dur}ms): ${err.message}`);
      report.steps.push({ name, status: 'FAIL', durationMs: dur, error: err.message });
      report.passed = false;
      const errShot = path.join(SCREENSHOT_DIR, `error-${name.replace(/[^a-z0-9]/gi, '_')}.png`);
      await page.screenshot({ path: errShot, fullPage: true }).catch(() => {});
      throw err;
    }
  }

  async function capture(fileName, caption) {
    const shotPath = path.join(SCREENSHOT_DIR, `${prefix}_${fileName}`);
    await page.screenshot({ path: shotPath, fullPage: false });
    report.screenshots.push({ fileName: `${prefix}_${fileName}`, caption, path: shotPath });
    console.log(`  📸 Captured screenshot: ${prefix}_${fileName}`);
  }

  try {
    // -------------------------------------------------------------
    // STEP 1: Landing Page & Onboarding Orientation
    // -------------------------------------------------------------
    await step('1. Landing Page Navigation & Career Toggles', async () => {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      if (!title.includes('GetJobReady')) throw new Error(`Unexpected title: ${title}`);

      // Verify Career toggles (Internship vs Full-time)
      const internshipToggle = page.locator('button:has-text("Internship")').first();
      const fulltimeToggle = page.locator('button:has-text("Full-time")').first();
      if (!await internshipToggle.isVisible() || !await fulltimeToggle.isVisible()) {
        throw new Error('Career toggles not visible on landing page');
      }
      await fulltimeToggle.click();
      await page.waitForTimeout(300);
      await internshipToggle.click();
      await page.waitForTimeout(300);

      // Verify "How it works" modal
      const howBtn = page.getByRole('button', { name: /How it works/i }).first();
      if (await howBtn.isVisible()) {
        await howBtn.click();
        await page.waitForTimeout(500);
        const modalVisible = await page.locator('.modal:has-text("HOW GETJOBREADY WORKS")').isVisible();
        if (!modalVisible) throw new Error('How it works modal failed to open');
        const closeBtn = page.locator('.modal-x').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.waitForTimeout(400);
      }

      await capture('01_landing_page.png', 'Landing Page Hero & Career Toggles');
    });

    // -------------------------------------------------------------
    // STEP 2: Student Login & Workspace Access
    // -------------------------------------------------------------
    const testEmail = `student_auditor_${Date.now()}@example.com`;
    await step('2. Student Login & Workspace Dashboard', async () => {
      const enterBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
      await enterBtn.click();
      await page.waitForTimeout(500);

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill(testEmail);
      await page.getByRole('button', { name: /Continue/i }).click();
      await page.waitForTimeout(1500);

      await page.locator('.dashboard').waitFor({ state: 'visible', timeout: 10000 });
      const dashText = await page.locator('.dash-head').innerText();
      if (!dashText.includes('Welcome back')) throw new Error(`Welcome greeting missing in: ${dashText}`);

      await capture('02_workspace_dashboard.png', 'Student Workspace Dashboard');
    });

    // -------------------------------------------------------------
    // STEP 3: Master CV Ingestion & AI CV Studio Review
    // -------------------------------------------------------------
    await step('3. Master CV Ingestion & Review Studio', async () => {
      const masterCard = page.locator('.master-cv-card').first();
      await masterCard.click();
      await page.waitForTimeout(1000);

      // On Resume screen
      const textarea = page.locator('#cvText, textarea').first();
      await textarea.waitFor({ state: 'visible', timeout: 10000 });
      await textarea.fill(sampleCV);

      await capture('03_master_cv_input.png', 'Master CV Pasted Text');

      // Click "Review & improve my CV"
      const reviewBtn = page.locator('button:has-text("Review & improve my CV")').first();
      await reviewBtn.click();

      // Wait for CV Studio to load
      await page.locator('.studio').waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForTimeout(1000);

      // Verify Score card and analysis sections
      const scoreBadge = page.locator('.score-ring strong').first();
      const scoreText = await scoreBadge.innerText();
      console.log(`     Master CV Score: ${scoreText}/100`);

      // Verify suggestions exist
      const suggestions = page.locator('.suggestion-item');
      const sugCount = await suggestions.count();
      console.log(`     CV Suggestions Found: ${sugCount}`);
      if (sugCount === 0) throw new Error('No suggestions found in CV Studio');

      // Click "Save & Go to Workspace"
      const saveBtn = page.locator('button:has-text("Save & Go to Workspace")').first();
      await saveBtn.click();
      await page.waitForTimeout(1500);

      // Verify returned to Workspace and Master CV card shows "Ready"
      const readyBadge = page.locator('.master-badge:has-text("Ready")');
      await readyBadge.waitFor({ state: 'visible', timeout: 8000 });

      await capture('04_cv_studio_saved.png', 'Master CV Saved and Verified Ready');
    });

    // -------------------------------------------------------------
    // STEP 4: Target Job Application (Tailored CV + JD)
    // -------------------------------------------------------------
    await step('4. Create Tailored Job Application (CV + JD)', async () => {
      const newAppBtn = page.locator('.new-card').first();
      await newAppBtn.click();
      await page.waitForTimeout(600);

      // Role modal opens
      const roleInput = page.locator('.login-card input[type="text"]');
      await roleInput.fill('McKinsey · Management Consulting Associate');
      const createBtn = page.locator('.login-card button:has-text("Create")');
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Should be on Resume screen with Master CV pre-loaded and JD box
      const jdTextarea = page.locator('#jdText, textarea').last();
      await jdTextarea.fill(sampleJD);

      await capture('05_job_specific_input.png', 'Tailored Job Application (Preloaded CV + Target JD)');

      // Click Review & improve my CV
      const reviewBtn = page.locator('button:has-text("Review & improve my CV")').first();
      await reviewBtn.click();

      // Wait for CV Studio
      await page.locator('.studio').waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForTimeout(1000);

      const tailoredScore = await page.locator('.score-ring strong').first().innerText();
      console.log(`     Tailored JD-CV Score: ${tailoredScore}/100`);

      await capture('06_tailored_cv_studio.png', 'Tailored CV Studio Review');
    });

    // -------------------------------------------------------------
    // STEP 5: AI Voice & Spoken Interview Simulation
    // -------------------------------------------------------------
    await step('5. Voice Interview Simulation & Evaluation Feedback', async () => {
      // From CV Studio, click "Save & start interview"
      const startIvBtn = page.locator('button:has-text("Save & start interview")').first();
      await startIvBtn.click();

      // Wait for Interview Screen
      await page.locator('.interview').waitFor({ state: 'visible', timeout: 25000 });
      await page.waitForTimeout(1500);

      // Verify Question 1 is visible
      const qText = await page.locator('.question-card h2').innerText();
      console.log(`     Question 1: "${qText.slice(0, 70)}..."`);
      if (!qText.trim()) throw new Error('Interview question text is empty');

      // Verify Voice Card
      const voiceCard = page.locator('.voice-card');
      if (!await voiceCard.isVisible()) throw new Error('Voice microphone card is not visible');

      await capture('07_voice_interview_q1.png', 'Voice Interview Question 1');

      const sampleAnswers = [
        'At Cars24, I led an analytical initiative evaluating dealer appraisal pricing across 14 regional hubs, using Python and SQL to identify key pricing friction points and reduce inspection turnaround time by 28%.',
        'When handling critical executive feedback, I follow an ABCD cognitive reframe: separating emotional tone from the business facts, acknowledging the deliverable gap immediately, and committing to an exact revision timeline.',
        'In my project at Deloitte, I encountered legacy data formatting inconsistencies across 4 ERP instances. I resolved this by designing an automated schema mapper in Python with strict validation checks.',
        'I use AI tools like Copilot and Claude for accelerated hypothesis testing, writing parameterized unit tests, and summarizing complex requirements, always cross-validating numerical outputs manually.',
        'If I join tomorrow, my 30-day plan is to master the core analytical pipelines, align with project managers on key deliverables, and contribute high-quality findings to our upcoming client presentations.',
        'My primary goal is to synthesize complex business datasets into clear executive recommendations that drive measurable cost reductions and operational efficiencies.'
      ];

      // Dynamically answer every turn until the interview completes and feedback arrives
      let answerCount = 0;
      while (answerCount < 10) {
        if (await page.locator('.feedback').isVisible()) {
          console.log('     Feedback screen reached!');
          break;
        }

        const isInterview = await page.locator('.interview').isVisible();
        if (!isInterview) {
          await page.waitForTimeout(1000);
          if (await page.locator('.feedback').isVisible()) break;
        }

        const qNumEl = page.locator('.q-number').first();
        const currentTurnLabel = (await qNumEl.isVisible()) ? await qNumEl.innerText() : `Turn ${answerCount + 1}`;
        console.log(`     Answering ${currentTurnLabel}...`);

        // Open type mode if not visible
        const typedInput = page.locator('#interviewTypedInput');
        if (!await typedInput.isVisible()) {
          const typeModeBtn = page.locator('button:has-text("Or type / paste answer")').first();
          if (await typeModeBtn.isVisible()) {
            await typeModeBtn.click();
            await page.waitForTimeout(400);
          }
        }

        await typedInput.waitFor({ state: 'visible', timeout: 10000 });
        const ans = sampleAnswers[answerCount % sampleAnswers.length];
        await typedInput.fill(ans);
        await page.waitForTimeout(300);

        // Wait for submit button to be enabled
        await page.waitForFunction(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Submit Typed Answer'));
          return btn && !btn.disabled;
        }, { timeout: 15000 });

        const submitBtn = page.locator('button:has-text("Submit Typed Answer")').first();
        await submitBtn.click();
        answerCount++;
        console.log(`     Submitted answer ${answerCount} for ${currentTurnLabel}`);

        // Wait for turn evaluation: either question advances or feedback screen appears
        await page.waitForFunction((prevLabel) => {
          if (document.querySelector('.feedback')) return true;
          const cur = document.querySelector('.q-number');
          return cur && cur.textContent.trim() !== prevLabel;
        }, currentTurnLabel, { timeout: 45000 });

        await page.waitForTimeout(1000);
      }

      // Verify Feedback Screen loads
      console.log('     Verifying Interview Feedback Screen contents...');
      await page.locator('.feedback').waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForTimeout(1500);

      const feedbackScore = await page.locator('.feedback .score-ring strong').first().innerText();
      console.log(`     Interview Performance Score: ${feedbackScore}/100`);

      await capture('08_interview_feedback_report.png', 'Comprehensive AI Interview Feedback & Model Answers');

      // Return to Workspace
      const backBtn = page.locator('button.back, button:has-text("Back")').first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(1000);
      }
    });

    // -------------------------------------------------------------
    // STEP 6: Impress the Interviewer (Live Prototype Builder)
    // -------------------------------------------------------------
    await step('6. Impress the Interviewer: Live AI Prototype Generator', async () => {
      // In Workspace: click "Impress the Interviewer"
      const impressCard = page.locator('button.module-card:has-text("Impress the Interviewer")').first();
      await impressCard.click();
      await page.waitForTimeout(1500);

      await page.locator('h2:has-text("Build a Credible Product Concept")').waitFor({ state: 'visible', timeout: 10000 });

      // Click "Zomato" case preset
      const zomatoPreset = page.locator('button:has-text("Zomato")').first();
      await zomatoPreset.click();
      await page.waitForTimeout(500);

      // Click "Build my interview demo"
      const buildBtn = page.locator('button:has-text("Build my interview demo")').first();
      await buildBtn.click();

      console.log('     Waiting for interactive prototype generation...');
      await page.locator('.module-result, iframe[title="Prototype Sandbox"]').first().waitFor({ state: 'visible', timeout: 40000 });
      await page.waitForTimeout(2000);

      // Verify iframe exists
      const iframe = page.locator('iframe[title="Prototype Sandbox"]');
      if (!await iframe.isVisible()) throw new Error('Interactive prototype iframe was not rendered');

      await capture('09_impress_interviewer_prototype.png', 'Interactive Prototype & Elevator Pitch');

      // Return to Workspace
      const backBtn = page.locator('button.back').first();
      await backBtn.click();
      await page.waitForTimeout(1000);
    });

    // -------------------------------------------------------------
    // STEP 7: Corporate Ready & Feedback Resilience Suite
    // -------------------------------------------------------------
    await step('7. Corporate Ready: Role-Play Chatbot, Playbooks & Free Courses', async () => {
      const corpCard = page.locator('button.module-card:has-text("Corporate Ready")').first();
      await corpCard.click();
      await page.waitForTimeout(1500);

      await page.locator('h2:has-text("Corporate Ready")').waitFor({ state: 'visible' });

      // Tab 1: Live Role-Play Simulator
      const replyInput = page.locator('.chat-input-box').first();
      await replyInput.fill('Thank you for the candid feedback. I acknowledge that the executive summary lacked key quantitative risk metrics. I have already drafted a revised table and will send it for your review by 3 PM today.');
      
      const sendBtn = page.locator('button.chat-send-btn, button:has-text("Send")').first();
      await sendBtn.click();

      console.log('     Waiting for manager reply and resilience scoring...');
      await page.locator('.coaching-card, .resilience-badge, .coach-score-badge').first().waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForTimeout(1000);

      await capture('10_corporate_roleplay_chat.png', 'Corporate Ready Role-Play & Resilience Scoring');

      // Tab 2: Resilience Playbooks & Frameworks
      const tab2Btn = page.locator('button:has-text("Resilience Playbooks & Frameworks")').first();
      await tab2Btn.click();
      await page.waitForTimeout(800);
      const abcdVisible = (await page.locator('text=/ABCD/i').count()) > 0;
      if (!abcdVisible) throw new Error('ABCD Model not found in Tab 2');

      // Tab 3: Free University Courses (100% Free)
      const tab3Btn = page.locator('button:has-text("Free University Courses")').first();
      await tab3Btn.click();
      await page.waitForTimeout(800);
      const coursesCount = await page.locator('.course-card').count();
      console.log(`     Corporate Ready Free Courses Count: ${coursesCount}`);
      if (coursesCount < 4) throw new Error(`Expected at least 4 free courses, found ${coursesCount}`);

      await capture('11_corporate_free_courses.png', 'Corporate Ready Verified University Courses');

      // Return to Workspace
      const backBtn = page.locator('button.back').first();
      await backBtn.click();
      await page.waitForTimeout(1000);
    });

    // -------------------------------------------------------------
    // STEP 8: AI at Work: Mentor Chatbot, Prompts & Free AI Courses
    // -------------------------------------------------------------
    await step('8. AI at Work: Live AI Mentor, Prompts & Certifications', async () => {
      const aiCard = page.locator('button.module-card:has-text("AI at Work")').first();
      await aiCard.click();
      await page.waitForTimeout(1500);

      await page.locator('h2:has-text("AI at Work")').waitFor({ state: 'visible' });

      // Tab 1: AI Workplace Mentor & Live Chat
      const mentorInput = page.locator('.chat-input-box').first();
      await mentorInput.fill('How can I use generative AI to synthesize messy meeting transcripts into an executive RACI matrix without missing critical commitments?');
      await page.waitForTimeout(300);

      const sendMentor = page.locator('button.chat-send-btn, button:has-text("Send")').first();
      await sendMentor.click();
      console.log('     Submitted message to Alex Rivera, waiting for guidance blueprint...');

      // Wait for Mentor Guidance Blueprint
      await page.locator('.mentor-guidance-card').waitFor({ state: 'visible', timeout: 35000 });
      await page.waitForTimeout(1500);

      const copyBtn = page.locator('button:has-text("Copy Prompt")').first();
      if (!await copyBtn.isVisible()) throw new Error('Copy prompt template button not visible in mentor response');

      await capture('12_ai_mentor_blueprint.png', 'AI Workplace Mentor Chatbot & Action Blueprint');

      // Tab 2: Battle-Tested Prompts & 7-Day Sprint
      const tab2Btn = page.locator('button:has-text("Battle-Tested Prompts & 7-Day Sprint")').first();
      await tab2Btn.click();
      await page.waitForTimeout(800);

      const promptButtons = page.locator('button:has-text("Discuss in Chat")');
      const promptCount = await promptButtons.count();
      console.log(`     Battle-Tested Prompts Count: ${promptCount}`);
      if (promptCount < 5) throw new Error(`Expected 5 prompt cards, found ${promptCount}`);

      // Click "Discuss in Chat" on first prompt card
      await promptButtons.first().click();
      await page.waitForTimeout(1200);

      // Verify transitioned back to Tab 1 with input prefilled
      const activeTab1 = await page.locator('button.roleplay-tab-btn.active:has-text("AI Workplace Mentor")').isVisible();
      if (!activeTab1) throw new Error('1-click Discuss in Chat did not transition to Tab 1');

      // Tab 3: Free AI Courses & Certifications
      const tab3Btn = page.locator('button:has-text("Free AI Courses & Certifications")').first();
      await tab3Btn.click();
      await page.waitForTimeout(800);

      const aiCourses = await page.locator('.course-card').count();
      console.log(`     Free AI Courses Count: ${aiCourses}`);
      if (aiCourses < 6) throw new Error(`Expected 6 free AI courses, found ${aiCourses}`);

      await capture('13_free_ai_courses.png', 'Verified 100% Free AI Courses & Certifications Hub');

      // Return to Workspace
      const backBtn = page.locator('button.back').first();
      await backBtn.click();
      await page.waitForTimeout(1000);
    });

    // -------------------------------------------------------------
    // STEP 9: Cross-Device Parity & Workspace State
    // -------------------------------------------------------------
    await step('9. Workspace Consistency, Tabs & Clean Logout', async () => {
      // In Workspace:
      // Verify Applications Tab has count >= 1
      const appsTab = page.getByRole('button', { name: /My Applications/i });
      await appsTab.click();
      await page.waitForTimeout(500);
      const appCards = await page.locator('.app-card').count();
      console.log(`     Saved Job Applications in Workspace: ${appCards}`);
      if (appCards === 0) throw new Error('Saved job application card missing in Workspace');

      // Verify Interview History Tab has count >= 1
      const ivTab = page.getByRole('button', { name: /Interview History/i });
      await ivTab.click();
      await page.waitForTimeout(500);
      const ivCards = await page.locator('.history-card').count();
      console.log(`     Saved Interviews in History: ${ivCards}`);
      if (ivCards === 0) throw new Error('Saved interview record missing in Interview History');

      await capture('14_workspace_final_state.png', 'Workspace Final Verified State with App and Interview');

      // Click "Sign out"
      const signoutBtn = page.getByRole('button', { name: /Sign out/i }).first();
      await signoutBtn.click();
      await page.waitForTimeout(1000);

      // Verify returned to Landing Hero
      const heroPresent = await page.locator('.hero').isVisible();
      if (!heroPresent) throw new Error('Sign out did not return to hero landing page');
    });

    report.completedAt = new Date().toISOString();
    console.log(`\n🎉 ALL 9 STUDENT JOURNEY WORKFLOWS PASSED 100% ON: ${label}!\n`);
  } catch (err) {
    report.completedAt = new Date().toISOString();
    report.fatalError = err.message;
    console.error(`\n💥 AUDIT FAILED ON ${label}:`, err.message);
  } finally {
    await browser.close();
  }

  return report;
}

async function main() {
  console.log('--- Ensuring clean port 4196 for audit ---');
  try {
    const { execSync } = await import('node:child_process');
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
  } catch {}
  await new Promise(r => setTimeout(r, 600));

  console.log('--- Spawning fresh local production server ---');
  const server = spawn(process.execPath, ['server.cjs'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'inherit'
  });

  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) { serverReady = true; break; }
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  if (!serverReady) throw new Error('Local server failed to start on port ' + PORT);
  let localReport = null;

  try {
    // Run full student audit on local production build
    localReport = await runStudentAudit(LOCAL_BASE, false);
    fs.writeFileSync('audit-local-report.json', JSON.stringify(localReport, null, 2));

    console.log('\n======================================================');
    console.log('🏁 FINAL AUDIT SUMMARY REPORT');
    console.log('======================================================');
    console.log(`Local Production Passed: ${localReport.passed ? '✅ YES' : '❌ NO'}`);
    console.log(`Total Steps Executed:   ${localReport.steps.length}`);
    console.log(`Total Screenshots Saved: ${localReport.screenshots.length}`);
    console.log('======================================================\n');

    if (!localReport.passed) {
      process.exit(1);
    }
  } finally {
    if (server) {
      server.kill('SIGTERM');
      try {
        const { execSync } = await import('node:child_process');
        execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
      } catch {}
    }
  }
}


main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
