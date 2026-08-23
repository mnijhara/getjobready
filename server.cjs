const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { generate, publicStatus, configured } = require('./ai-router.cjs');

const app = express();
const PORT = process.env.PORT || 4173;
const root = __dirname;

app.use(cors());
app.use(express.json({ limit: '4mb' }));

const fallback = {
  score: 58,
  headline: 'You have a base — now make it role-specific.',
  summary: 'Use the role requirements to sharpen your story, evidence and interview practice.',
  highlights: ['Your profile has transferable strengths', 'Academic and project work can become strong evidence', 'Focused practice will improve interview confidence'],
  gaps: ['Add measurable outcomes to important CV bullets', 'Prepare STAR stories mapped to the role', 'Research the company and role before interviewing'],
  plan: ['Rewrite your top 3 CV bullets around outcomes', 'Prepare a 90-second introduction', 'Build 3 STAR stories from projects or internships', 'Research the company and role', 'Practise 5 role-specific questions', 'Complete a timed mock interview', 'Review feedback and repeat'],
  interviewQuestions: ['Tell me about yourself and why this role?', 'Walk me through a project where you solved a difficult problem.', 'What is your strongest evidence that you can succeed in this role?', 'Tell me about a time you received difficult feedback.', 'What would you do in your first 30 days?'],
};

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'getjobready', ai: publicStatus() }));
app.get('/api/ai-status', (req, res) => res.json(publicStatus()));

app.post('/api/analyze', async (req, res) => {
  const { cv = '', jd = '', career = 'job' } = req.body || {};
  if (!cv.trim() && !jd.trim()) return res.status(400).json({ error: 'CV and job description are required.' });
  try {
    const result = await generate(`You are an expert campus recruiter, CV strategist and career coach. Analyse this student's CV against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly these keys: score (number 0-100), headline (string), summary (string), highlights (array of max 4 concise strings), gaps (array of max 5 strings), plan (array of exactly 7 actionable strings), interviewQuestions (array of exactly 5 role-specific questions). Prioritise evidence, skills, role fit, measurable impact and realistic campus-placement advice.\n\nCV:\n${cv}\n\nJOB DESCRIPTION:\n${jd}`);
    return res.json(result);
  } catch (error) {
    console.error('analyze:', error.message);
    return res.json(fallback);
  }
});

app.post('/api/interview-feedback', async (req, res) => {
  const { jd = '', answers = [] } = req.body || {};
  try {
    const result = await generate(`You are a demanding but supportive campus interviewer. Evaluate these interview answers against the target JD. Return ONLY valid JSON with exactly: score (0-100), strengths (array max 4), improvements (array max 4), nextAction (string). Assess clarity, structure, evidence, ownership, relevance, communication, confidence and business thinking. Give specific actionable feedback, not generic advice.\n\nTARGET JD:\n${jd}\n\nANSWERS:\n${JSON.stringify(answers)}`);
    return res.json(result);
  } catch (error) {
    console.error('interview-feedback:', error.message);
    const words = answers.reduce((n, a) => n + String(a.answer || '').trim().split(/\s+/).filter(Boolean).length, 0);
    return res.json({ score: Math.min(94, Math.max(62, 68 + Math.min(18, Math.floor(words / 35)))), strengths: ['You completed the full interview', 'Your answers show preparation and intent', 'You demonstrated willingness to reflect'], improvements: ['Use Situation → Action → Result', 'Add numbers, scope or concrete evidence', 'Lead with the outcome and keep context concise'], nextAction: 'Repeat the interview and make every example end with a clear result and learning.' });
  }
});

app.post('/api/demo', async (req, res) => {
  const { company = 'Target company', problem = '', idea = '' } = req.body || {};
  if (!problem.trim()) return res.status(400).json({ error: 'Describe the company problem first.' });
  try {
    const result = await generate(`You are a product strategist helping a student impress a corporate interviewer. Analyse the stated company problem and create a credible product concept. Return ONLY valid JSON with: title, tagline, users, impact, pitch (array of 4 bullets), html. The html must be a complete self-contained polished HTML document, with inline CSS only, responsive, no external assets, and suitable to open as a live demo. Company: ${company}. Problem: ${problem}. Candidate idea: ${idea}`);
    return res.json(result);
  } catch (error) {
    console.error('demo:', error.message);
    return res.json({ title: `${company} — ${idea || 'A focused solution'}`, tagline: 'A candidate-built prototype around a real business problem.', users: 'Customers, frontline teams and business owners', impact: 'Reduce friction, improve visibility and create a measurable workflow.', pitch: ['Clear problem-to-solution narrative', 'Designed around a specific user', 'Focused on measurable business impact', 'Ready to discuss with an interviewer'], html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${company} demo</title><style>body{font-family:system-ui;margin:0;background:#f5f7fb;color:#172033}main{max-width:820px;margin:40px auto;padding:32px;background:#fff;border-radius:24px;box-shadow:0 15px 45px #0001}h1{font-size:42px;margin:0 0 10px}p{color:#667085;line-height:1.6}.cta{display:inline-block;background:#172033;color:#fff;padding:13px 18px;border-radius:10px}</style></head><body><main><small>PRODUCT CONCEPT</small><h1>${company}</h1><p>${problem}</p><h2>${idea || 'A simpler digital workflow'}</h2><p>A candidate-built concept that turns the problem into a clear, usable experience.</p><a class="cta">Explore prototype</a></main></body></html>` });
  }
});

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(200).send('GetJobReady build is being prepared.'));
}

app.listen(PORT, () => console.log(`GetJobReady running on ${PORT}; Gemini slots=${publicStatus().keySlots}`));
