import { chromium, devices } from 'playwright';

const BASE = process.env.GJR_BASE_URL || 'https://getjobready.online/';
const CV = `Alex Student\nComputer Science Student\nEducation: B.Tech Computer Science, Example University\nProjects: Built a campus placement tracker using React and Supabase.\nSkills: React, JavaScript, SQL, Python`;
const JD = `Management Trainee Intern\nWork with cross-functional teams, analyse business problems, communicate recommendations, and use data and AI tools to improve execution.`;

const failures = [];
const passes = [];
const pass = (m) => { passes.push(m); console.log('[PASS]', m); };
const fail = (m) => { failures.push(m); console.error('[FAIL]', m); };

function assertJson(value, label) {
  if (!value || typeof value !== 'object') throw new Error(`${label}: response was not JSON`);
}

function questionSafety(question) {
  const q = String(question || '');
  const forbidden = [/consulting/i, /dealer/i, /chatgpt/i, /claude/i, /copilot/i, /42%/i, /50,000/i, /backend engineer/i, /at vijit/i];
  return !forbidden.some((re) => re.test(q));
}

async function run(label, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...contextOptions, permissions: ['microphone'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!/GetJobReady/i.test(await page.locator('body').innerText())) throw new Error('homepage did not load');
    pass(`${label}: homepage loaded in Chromium`);

    const health = await page.evaluate(async () => {
      const r = await fetch('/api/health', { cache: 'no-store' });
      return { status: r.status, contentType: r.headers.get('content-type'), text: await r.text() };
    });
    if (health.status !== 200 || !/application\/json/i.test(health.contentType || '')) throw new Error(`${label}: /api/health returned ${health.status} ${health.contentType} ${health.text.slice(0,120)}`);
    const healthJson = JSON.parse(health.text);
    assertJson(healthJson, `${label}: /api/health`);
    if (!healthJson.ok) throw new Error(`${label}: API health is not ok`);
    pass(`${label}: /api/health is live JSON`);

    const analysis = await page.evaluate(async ({ cv, jd }) => {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cv, jd, career: 'internship', mode: 'specific' }) });
      return { status: r.status, contentType: r.headers.get('content-type'), text: await r.text() };
    }, { cv: CV, jd: JD });
    if (analysis.status !== 200 || !/application\/json/i.test(analysis.contentType || '')) throw new Error(`${label}: /api/analyze returned ${analysis.status} ${analysis.contentType} ${analysis.text.slice(0,120)}`);
    const result = JSON.parse(analysis.text);
    assertJson(result, `${label}: /api/analyze`);
    if (!Array.isArray(result.interviewQuestions) || result.interviewQuestions.length !== 5) throw new Error(`${label}: expected exactly 5 interview questions`);
    if (result.interviewQuestions.some((q) => !questionSafety(q))) throw new Error(`${label}: interview question contained an unsupported candidate fact`);
    pass(`${label}: CV/JD analysis returned 5 grounded interview questions`);

    const firstQuestion = String(result.interviewQuestions[0]);
    const turn = await page.evaluate(async ({ cv, jd, question }) => {
      const r = await fetch('/api/interview-turn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cv, jd, mode: 'specific', career: 'internship', question, answer: 'I built a campus placement tracker using React and Supabase and owned the implementation and workflow improvements.', history: [], turn: 1, maxTurns: 3 }) });
      return { status: r.status, contentType: r.headers.get('content-type'), text: await r.text() };
    }, { cv: CV, jd: JD, question: firstQuestion });
    if (turn.status !== 200 || !/application\/json/i.test(turn.contentType || '')) throw new Error(`${label}: /api/interview-turn returned ${turn.status} ${turn.contentType} ${turn.text.slice(0,120)}`);
    const turnJson = JSON.parse(turn.text);
    assertJson(turnJson, `${label}: /api/interview-turn`);
    if (turnJson.done !== true && !String(turnJson.nextQuestion || '').trim()) throw new Error(`${label}: interview turn did not return a next question`);
    if (turnJson.nextQuestion && !questionSafety(turnJson.nextQuestion)) throw new Error(`${label}: follow-up question contained an unsupported candidate fact`);
    pass(`${label}: interview-turn returned valid grounded JSON`);
  } catch (e) {
    fail(`${label}: ${e.message}`);
  } finally {
    if (errors.length) console.log(`[INFO] ${label}: browser diagnostics: ${errors.slice(0,8).join(' | ')}`);
    await context.close();
    await browser.close();
  }
}

await run('desktop', { viewport: { width: 1440, height: 900 } });
await run('mobile', { ...devices['Pixel 7'] });
const report = { base: BASE, passed: failures.length === 0, passes, failures, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
