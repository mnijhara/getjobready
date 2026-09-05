import { chromium, devices } from 'playwright';

const BASE = process.env.GJR_BASE_URL || 'https://getjobready.online/';
const VIJIT_CV = `Vijit Vishnoi
Backend Engineer | Full Stack Developer | Software Engineer
Education: Indian Institute of Information Technology, Ranchi — B.Tech Computer Science & Engineering, 2023-2027, CGPA 8.5/10
Experience: Coding Panda — Full Stack Intern, Sept 2025-Nov 2025
Coding Panda: Streamlined test case batch storage with Cloudflare R2; designed and integrated Judge 0 execution APIs with real-time execution, error diagnostics and resource tracking; partnered with senior developers in Agile to scale a basic compiler into a production-grade platform supporting 5+ languages.
Coding Panda technologies: JavaScript, TypeScript, Express, Node.js, Next.js, MongoDB, OAuth, Tailwind CSS, Monaco Editor, Cloudflare R2
Achievements: 800+ algorithmic challenges across Codeforces, CodeChef and LeetCode; 3-Star CodeChef, Knight LeetCode, Pupil Codeforces; authored CI-validated automated boundary tests exposing a Windows session bug.
Project: Sync Engine — real-time collaborative code editor using Go and React, custom CRDT engine with fractional indexing for state consistency across concurrent edits; Upstash Redis Pub/Sub and Gorilla WebSockets; 50 ms adaptive batching; write-behind Go cache with 5-second debounced ticker to MongoDB Atlas; isolated remote execution for live multi-language compilation.
Project: TravelGen AI — Go/Gin backend and React/TypeScript frontend; processes 5+ parameters to generate itineraries up to 14 days; LLM-driven data pipeline with strict JSON schemas and 50+ data points per query; React-Leaflet route visualizer with up to 15+ daily activity markers.
Project: Edusphere — Node.js, Express, React, Sequelize and MySQL LMS; stress-tested under 200 concurrent users with 100% API success rate; RBAC with JWT; 20+ REST APIs.
Technical skills: C, C++, Java, Go, JavaScript, Python, TypeScript, HTML, Tailwind CSS, React.js, Next.js, gRPC, Express, Node.js, REST APIs, Socket.IO, MongoDB, MySQL, Redis, Docker, Kubernetes, AWS, GCP, Azure, CI/CD, Cloudflare R2, Git, GitHub, VS Code, Linux, Figma, Jira.
Coursework: DSA, OOP, DBMS, Operating Systems, Artificial Intelligence, Computer Networks, Software Engineering, System Design.
Leadership: led a 3-person engineering team for the Adobe Hackathon; advanced past 50,000+ teams to the Semifinals; progressed from Vice-Captain to Captain of the College Table Tennis team, mentoring 14 peers and winning first place at the Inter-IIIT Sports Meet 2025 among 20 teams.`;

const passes = [];
const failures = [];
const pass = (m) => { passes.push(m); console.log('  [PASS]', m); };
const fail = (m) => { failures.push(m); console.error('  [FAIL]', m); };

async function verifyStudentJourney(label, contextOptions) {
  console.log(`\n=== Running Live Student Journey Audit (${label}) ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...contextOptions,
    permissions: ['microphone']
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  try {
    // 1. Mock TTS and SpeechRecognition before page load
    await page.addInitScript(() => {
      class MockRecognition {
        constructor() {
          this.continuous = true;
          this.interimResults = true;
          this.lang = 'en-IN';
        }
        start() {
          this.onstart?.();
          setTimeout(() => {
            this.onresult?.({
              resultIndex: 0,
              results: [{
                0: { transcript: 'I took full ownership of streamlining test case batch storage with Cloudflare R2.', confidence: 0.98 },
                isFinal: true
              }]
            });
          }, 300);
        }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      }
      window.SpeechRecognition = MockRecognition;
      window.webkitSpeechRecognition = MockRecognition;
      window.speechSynthesis = {
        cancel() {},
        speak(u) { setTimeout(() => u.onend?.(), 100); },
        getVoices() { return [{ name: 'Google English India', lang: 'en-IN' }]; }
      };
    });

    // 2. Load Live Homepage
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').innerText();
    if (!/GetJobReady/i.test(bodyText)) throw new Error('Homepage failed to load');
    pass(`${label}: Homepage loaded successfully`);

    // 3. Login to Workspace
    const enterBtn = page.getByRole('button', { name: /Enter Workspace/i }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('vijit.vishnoi@example.com');
        await page.getByRole('button', { name: /Continue/i }).click();
        await page.waitForTimeout(1000);
        pass(`${label}: Authenticated / Entered workspace`);
      }
    }

    // 4. Click Master CV card in Dashboard
    const masterCard = page.locator('.master-cv-card, .pipe-step').first();
    await masterCard.waitFor({ state: 'visible', timeout: 10000 });
    await masterCard.click();
    await page.waitForTimeout(1000);
    pass(`${label}: Clicked Master CV to enter Resume Prep`);

    // 5. Fill Vijit CV in textarea
    const cvTextarea = page.locator('#cvText');
    await cvTextarea.waitFor({ state: 'visible', timeout: 10000 });
    await cvTextarea.fill(VIJIT_CV);
    pass(`${label}: Pasted Vijit CV into editor`);

    // 6. Click "Review & improve my CV"
    const reviewBtn = page.getByRole('button', { name: /Review & improve my CV/i }).first();
    await reviewBtn.waitFor({ state: 'visible', timeout: 10000 });
    await reviewBtn.click();
    pass(`${label}: Clicked Review & improve my CV`);

    // 7. Arrive at CV Studio
    const startInterviewBtn = page.getByRole('button', { name: /Direct Audio Interview|Save & start interview/i }).first();
    await startInterviewBtn.waitFor({ state: 'visible', timeout: 20000 });
    pass(`${label}: Arrived at CV Studio`);

    // 8. Launch Audio Interview
    await startInterviewBtn.click();
    await page.waitForTimeout(1500);
    pass(`${label}: Launched Audio Interview`);

    // 9. In Interview: Verify all 6 questions
    const questionCard = page.locator('.question-card h2');
    await questionCard.waitFor({ state: 'visible', timeout: 15000 });
    const q1 = (await questionCard.innerText()).trim();
    console.log(`\n  [Question 1]: "${q1}"`);

    if (/proud of|Walk me through/i.test(q1)) {
      pass(`${label}: Q1 is grounded introductory STAR prompt`);
    }

    // Answer Q1
    await page.waitForTimeout(1200);
    const submitBtn = page.getByRole('button', { name: /Done Speaking · Submit Now|Submit/i }).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Question 2
    const q2 = (await questionCard.innerText()).trim();
    console.log(`  [Question 2]: "${q2}"`);

    // Answer Q2
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Question 3
    const q3 = (await questionCard.innerText()).trim();
    console.log(`  [Question 3]: "${q3}"`);

    // Answer Q3
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Question 4 (The Mandatory AI Question!)
    const q4 = (await questionCard.innerText()).trim();
    console.log(`  [Question 4 - Mandatory AI]: "${q4}"`);

    // VERIFICATION OF MANDATORY AI QUESTION
    const expectedAiSubstring = 'How have you used AI in your job, internship, or SIP';
    if (q4.includes(expectedAiSubstring)) {
      pass(`${label}: Q4 is the exact mandatory AI question!`);
    } else {
      fail(`${label}: Q4 expected mandatory AI question, got: "${q4}"`);
    }

    // Answer Q4
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Question 5
    const q5 = (await questionCard.innerText()).trim();
    console.log(`  [Question 5]: "${q5}"`);

    // Answer Q5
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Question 6
    const q6 = (await questionCard.innerText()).trim();
    console.log(`  [Question 6]: "${q6}"`);

    // Answer Q6 to complete the interview
    await submitBtn.click();
    await page.waitForTimeout(2500);

    // 10. Arrive at Feedback Screen
    const feedbackTitle = page.locator('.workspace-head h1, main h1').first();
    await feedbackTitle.waitFor({ state: 'visible', timeout: 15000 });
    const fbText = await page.locator('body').innerText();
    pass(`${label}: Arrived at Feedback screen`);

    // 11. Inspect Model Answers in Feedback
    if (fbText.includes('Do not invent metrics') || fbText.includes('Build this answer from your real CV') || fbText.includes('Use only the exact CV evidence')) {
      pass(`${label}: Model answers are grounded coaching templates without invented metrics`);
    } else {
      fail(`${label}: Model answers missing safe coaching disclaimer`);
    }

    // 12. P4 DEFECT CHECKS ACROSS ALL QUESTIONS & FEEDBACK:
    const allQText = [q1, q2, q3, q4, q5, q6].join(' ');

    // Check 1: NO "Consulting"
    if (!/consulting/i.test(allQText)) {
      pass(`${label}: NO fabricated "Consulting" in questions`);
    } else {
      fail(`${label}: Found fabricated "Consulting" in questions`);
    }

    // Check 2: NO fabricated Cloudflare R2 metrics (e.g. 42%, 30% storage costs)
    if (!/42%|reduced batch upload latency|cut monthly storage costs by 30%/i.test(fbText)) {
      pass(`${label}: NO fabricated Cloudflare R2 metrics (42% latency, 30% storage)`);
    } else {
      fail(`${label}: Found fabricated Cloudflare R2 metrics in model answers!`);
    }

    // Check 3: NO "Vijit Vishnoi Backend Engineer" employer hallucination
    if (!/at Vijit Vishnoi Backend Engineer|at Vijit/i.test(allQText + ' ' + fbText)) {
      pass(`${label}: NO invented employer "Vijit Vishnoi Backend Engineer"`);
    } else {
      fail(`${label}: Found invented employer reference`);
    }

    // Check 4: NO "dealer" references
    if (!/dealer/i.test(allQText + ' ' + fbText)) {
      pass(`${label}: NO unsupported "dealer" references`);
    } else {
      fail(`${label}: Found unsupported "dealer" references`);
    }

  } catch (err) {
    fail(`${label}: ${err.message}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  await verifyStudentJourney('Desktop (1440x900)', { viewport: { width: 1440, height: 900 } });
  await verifyStudentJourney('Mobile (Pixel 7)', { ...devices['Pixel 7'] });

  console.log('\n=======================================');
  console.log(`TOTAL PASSES: ${passes.length}`);
  console.log(`TOTAL FAILURES: ${failures.length}`);
  console.log('=======================================');

  if (failures.length > 0) {
    process.exit(1);
  }
}

main();
