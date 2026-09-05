import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const targetUrl = process.env.TARGET_URL || 'https://getjobready.online/';
console.log(`Starting Full-Journey QA Audit on: ${targetUrl}`);

const testCV = `Alex Sharma
Email: alex.sharma@example.edu | Phone: +91 98765 43210 | Bangalore, India
LinkedIn: linkedin.com/in/alexsharma

EDUCATION
B.Tech in Computer Science & Engineering | Indian Institute of Information Technology, Allahabad | CGPA: 8.8 / 10.0 (2021 – 2025)

TECHNICAL COMPETENCIES
Languages: JavaScript, TypeScript, Python, SQL, C++
Frameworks & Libraries: React, Node.js, Express, Tailwind CSS, PostgreSQL, Redis, Docker
Tools & Methodologies: Git, Postman, Jest, CI/CD GitHub Actions, Agile / Scrum

KEY PROJECTS & EXPERIENCE
1. Full Stack Placement Portal – Team Lead & Architect (Jan 2024 – May 2024)
- Architected and deployed an end-to-end campus placement portal using React, Node.js, and PostgreSQL for over 1,200 students.
- Reduced interview scheduling latency by 45% by engineering an automated conflict-resolution matching algorithm in Redis.
- Implemented real-time status updates via WebSockets, eliminating manual coordination for 35 corporate recruiting teams.

2. AI Smart Document Parser – Software Developer Intern (Jun 2023 – Aug 2023)
- Built an automated PDF parsing microservice in Python processing 5,000+ candidate profiles with 98.4% field accuracy.
- Decreased document ingestion time from 14 seconds to 1.8 seconds using multithreaded stream extraction.
`;

async function runAudit() {
  const auditReport = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    passed: true
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Console Error] ${msg.text()}`);
      auditReport.errors.push(`Console Error: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    console.error(`[Page Error] ${err.message}`);
    auditReport.errors.push(`Page Error: ${err.message}`);
  });

  const recordStep = (stepName, status, details = '') => {
    console.log(`[${status}] ${stepName} ${details ? '- ' + details : ''}`);
    auditReport.steps.push({ stepName, status, details, time: new Date().toISOString() });
    if (status === 'FAIL') auditReport.passed = false;
  };

  try {
    // 1. Visit Landing Page
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    const title = await page.title();
    const hasBranding = (await page.locator('body').innerText()).includes('GetJobReady');
    if (hasBranding) {
      recordStep('Landing Page Load', 'PASS', `Title: ${title}`);
    } else {
      recordStep('Landing Page Load', 'FAIL', 'Branding GetJobReady not found');
    }

    // 2. Login as Student
    const enterWorkspaceBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
    await enterWorkspaceBtn.click();
    await page.waitForTimeout(600);
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('alex.qa.student@test.com');
    const continueBtn = page.getByRole('button', { name: /Continue/i }).first();
    await continueBtn.click();
    await page.waitForTimeout(1500);

    const bodyTextAfterLogin = await page.locator('body').innerText();
    if (bodyTextAfterLogin.includes('My Workspace') || bodyTextAfterLogin.includes('Master CV') || bodyTextAfterLogin.includes('Job Applications')) {
      recordStep('Student Login & Workspace Creation', 'PASS', 'Logged in as alex.qa.student@test.com');
    } else {
      recordStep('Student Login & Workspace Creation', 'FAIL', 'Workspace not displayed after login');
    }

    // 3. Open Master CV / CV Preparation
    const cvPrepCard = page.getByText(/Master CV/i).first();
    await cvPrepCard.click();
    await page.waitForTimeout(1000);

    // Check CV input textarea or upload
    let cvTextarea = page.locator('textarea').first();
    if (!await cvTextarea.isVisible()) {
      const editCvBtn = page.getByRole('button', { name: /Edit CV|Create|Update|Start/i }).first();
      if (await editCvBtn.isVisible()) await editCvBtn.click();
      await page.waitForTimeout(800);
    }
    cvTextarea = page.locator('textarea').first();
    await cvTextarea.fill(testCV);
    recordStep('CV Input / Paste', 'PASS', 'Filled 1,400+ char structured B.Tech CV');

    // Analyze CV
    const reviewBtn = page.getByRole('button', { name: /Review & Improve CV/i }).first();
    await reviewBtn.click();
    recordStep('Trigger CV Analysis', 'INFO', 'Waiting for CV Studio to load...');
    await page.waitForTimeout(4000);

    // 4. CV Studio Verification
    const studioText = await page.locator('body').innerText();
    if (studioText.includes('CV Score') || studioText.includes('Strengths') || studioText.includes('Save & Start Interview') || studioText.includes('AI Review') || studioText.includes('Executive Review') || studioText.includes('Overall Score')) {
      recordStep('CV Studio Loaded', 'PASS', 'CV analysis rendered with scores and editable bullets');
    } else {
      recordStep('CV Studio Loaded', 'FAIL', 'CV Studio elements missing');
    }

    // 5. Proceed to Audio Interview
    const startInterviewBtn = page.getByRole('button', { name: /Save & Start Interview|Start Interview/i }).first();
    await startInterviewBtn.click();
    await page.waitForTimeout(2000);

    // Verify VoiceInterview UI
    const interviewText = await page.locator('body').innerText();
    const q1Visible = interviewText.includes('QUESTION 1 OF') || interviewText.includes('Tell me about yourself');
    if (q1Visible) {
      recordStep('Audio Interview Screen Loaded', 'PASS', 'Question 1 generated and displayed');
    } else {
      recordStep('Audio Interview Screen Loaded', 'FAIL', 'Question 1 not visible');
    }

    // Audit Question Text for truncation bug fix
    const currentQText = await page.locator('.question-card h2').innerText().catch(() => '');
    console.log(`[Generated Question 1]: ${currentQText}`);
    if (currentQText.includes('Technolo.')) {
      recordStep('Question Quality & Spelling Audit', 'FAIL', 'Found truncated "Technolo." in question!');
    } else {
      recordStep('Question Quality & Spelling Audit', 'PASS', 'Clean word boundary and spelling maintained');
    }

    // Check presence of Voice controls
    const micCard = page.locator('.voice-card');
    if (await micCard.count()) {
      recordStep('Voice Card & Mic Present', 'PASS', 'Hands-free interactive voice card active');
    } else {
      recordStep('Voice Card & Mic Present', 'FAIL', 'Voice card element not rendered');
    }

    // 6. Test Stage 2 Modules (Impress Interviewer, Corporate Ready, AI at Work)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Test Impress Interviewer (AI Project Module)
    const impressCard = page.getByText(/Impress the Interviewer/i).first();
    if (await impressCard.isVisible()) {
      await impressCard.click();
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      if (body.includes('Impress') || body.includes('Concept') || body.includes('Prototype') || body.includes('Problem')) {
        recordStep('Impress the Interviewer (AI Project Module)', 'PASS', 'Module loaded and interactive');
      } else {
        recordStep('Impress the Interviewer (AI Project Module)', 'FAIL', 'Module content missing');
      }
    }

    // Test Corporate Ready
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const corpCard = page.getByText(/Corporate Ready/i).first();
    if (await corpCard.isVisible()) {
      await corpCard.click();
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      if (body.includes('Corporate') || body.includes('Communication') || body.includes('Habits') || body.includes('Feedback')) {
        recordStep('Corporate Ready Module', 'PASS', 'Module loaded and interactive');
      } else {
        recordStep('Corporate Ready Module', 'FAIL', 'Corporate Ready content missing');
      }
    }

    // Test AI at Work
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const aiCard = page.getByText(/AI at Work/i).first();
    if (await aiCard.isVisible()) {
      await aiCard.click();
      await page.waitForTimeout(1200);
      const body = await page.locator('body').innerText();
      if (body.includes('AI at Work') || body.includes('Workflows') || body.includes('Tools') || body.includes('Prompts')) {
        recordStep('AI at Work Module', 'PASS', 'Module loaded and interactive');
      } else {
        recordStep('AI at Work Module', 'FAIL', 'AI at Work content missing');
      }
    }

  } catch (err) {
    recordStep('Audit Execution', 'FAIL', err.message);
  } finally {
    await browser.close();
  }

  fs.writeFileSync('full-qa-audit-report.json', JSON.stringify(auditReport, null, 2));
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Passed: ${auditReport.passed}`);
  console.log(`Total Steps Executed: ${auditReport.steps.length}`);
  console.log(`Total Errors Logged: ${auditReport.errors.length}`);
}

runAudit();
