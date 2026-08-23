const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { generate, publicStatus } = require('./ai-router.cjs');
const app = express();
const PORT = process.env.PORT || 4173;
const root = __dirname;
app.use(cors());
app.use(express.json({ limit: '8mb' }));

const fallback = { score: 58, headline: 'You have a base — now make it role-specific.', summary: 'Use the role requirements to sharpen your story, evidence and interview practice.', highlights: ['Your profile has transferable strengths', 'Academic and project work can become strong evidence', 'Focused practice will improve interview confidence'], gaps: ['Add measurable outcomes to important CV bullets', 'Prepare STAR stories mapped to the role', 'Research the company and role before interviewing'], cvImprovements: ['Lead bullets with action + outcome', 'Quantify scope, impact or scale wherever possible', 'Move the most relevant skills and projects higher'], rewrittenBullets: ['Led a project that improved a measurable business outcome by using a structured approach.', 'Collaborated with a cross-functional team to deliver a project within the agreed timeline.'], plan: ['Rewrite your top 3 CV bullets around outcomes', 'Prepare a 90-second introduction', 'Build 3 STAR stories from projects or internships', 'Research the company and role', 'Practise 5 role-specific questions', 'Complete a timed mock interview', 'Review feedback and repeat'], interviewQuestions: ['Tell me about yourself and why this role?', 'Walk me through a project where you solved a difficult problem.', 'What is your strongest evidence that you can succeed in this role?', 'Tell me about a time you received difficult feedback.', 'What would you do in your first 30 days?'] };

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'getjobready', ai: publicStatus() }));
app.get('/api/ai-status', (req, res) => res.json(publicStatus()));

const analysisPrompt = (cv, jd, career) => `You are an expert campus recruiter, CV strategist and career coach. Analyse this student's CV against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 role-specific questions). Prioritise evidence, skills, role fit, measurable impact and realistic campus-placement advice.\n\nCV:\n${cv}\n\nJOB DESCRIPTION:\n${jd}`;

app.post('/api/analyze', async (req, res) => {
  const { cv = '', jd = '', career = 'job' } = req.body || {};
  if (!cv.trim() && !jd.trim()) return res.status(400).json({ error: 'CV and job description are required.' });
  try { return res.json(await generate(analysisPrompt(cv, jd, career))); }
  catch (error) { console.error('analyze:', error.message); return res.json(fallback); }
});

app.post('/api/analyze-upload', async (req, res) => {
  const { data = '', mime = 'application/pdf', name = 'CV', jd = '', career = 'job' } = req.body || {};
  if (!data) return res.status(400).json({ error: 'CV file data is required.' });
  if (data.length > 7_000_000) return res.status(413).json({ error: 'CV file is too large. Please keep it under 5 MB.' });
  try {
    const prompt = `You are an expert campus recruiter. Read the attached CV and analyse it against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7), interviewQuestions (exactly 5). Target JD:\n${jd}`;
    return res.json(await generate('', { parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }));
  } catch (error) { console.error('analyze-upload:', error.message); return res.json(fallback); }
});

app.post('/api/interview-feedback', async (req, res) => {
  const { jd = '', answers = [] } = req.body || {};
  try { return res.json(await generate(`You are a demanding but supportive campus interviewer. Evaluate these interview answers against the target JD. Return ONLY valid JSON with exactly: score (0-100), strengths (max 4), improvements (max 4), nextAction. Assess clarity, structure, evidence, ownership, relevance, communication, confidence and business thinking.\n\nTARGET JD:\n${jd}\n\nANSWERS:\n${JSON.stringify(answers)}`)); }
  catch (error) { const words = answers.reduce((n, a) => n + String(a.answer || '').trim().split(/\s+/).filter(Boolean).length, 0); return res.json({ score: Math.min(94, Math.max(62, 68 + Math.min(18, Math.floor(words / 35)))), strengths: ['You completed the full interview', 'Your answers show preparation and intent', 'You demonstrated willingness to reflect'], improvements: ['Use Situation → Action → Result', 'Add numbers, scope or concrete evidence', 'Lead with the outcome and keep context concise'], nextAction: 'Repeat the interview and make every example end with a clear result and learning.' }); }
});

app.post('/api/interview-turn', async (req, res) => {
  const { jd = '', career = 'job', question = '', answer = '', history = [], turn = 1, maxTurns = 7 } = req.body || {};
  if (!question.trim() || !answer.trim()) return res.status(400).json({ error: 'Question and answer are required.' });
  const prompt = `You are conducting a realistic campus-to-corporate voice interview for a ${career === 'internship' ? 'summer internship' : 'full-time role'}. This is a live conversation, not a questionnaire. Evaluate the candidate's latest spoken answer, decide whether to probe deeper or move to a new competency, and ask exactly ONE concise next question when continuing. Be natural, specific to the JD, and progressively harder. Do not repeat questions. If the candidate gives a vague claim, ask for evidence; if they give a strong example, probe impact or learning. After ${maxTurns} turns, end the interview. Return ONLY JSON with exactly: done (boolean), nextQuestion (string), evaluation (object with score 0-100, strengths array max 2, improvement string), finalFeedback (object or null). If done=true, nextQuestion must be empty and finalFeedback must contain score (0-100), strengths (max 4), improvements (max 4), nextAction. If done=false, finalFeedback must be null.\n\nTARGET JD:\n${jd}\n\nTURN ${turn} OF ${maxTurns}\nCURRENT QUESTION:\n${question}\n\nCANDIDATE ANSWER:\n${answer}\n\nPREVIOUS TURNS:\n${JSON.stringify(history).slice(0, 12000)}`;
  try {
    const data = await generate(prompt, { maxOutputTokens: 2500 });
    if (!data || typeof data !== 'object') throw new Error('Invalid interview turn');
    if (turn >= maxTurns) data.done = true;
    return res.json(data);
  } catch (error) {
    console.error('interview-turn:', error.message);
    const fallbackQuestions = ['Tell me about a project where you had to influence someone without authority.', 'What would you do if your manager gave you two urgent priorities at the same time?', 'Tell me about a failure or setback and what changed afterwards.', 'Why should we choose you over another candidate with similar academic credentials?'];
    const next = fallbackQuestions[Math.min(turn - 1, fallbackQuestions.length - 1)];
    return res.json(turn >= maxTurns ? { done: true, nextQuestion: '', evaluation: { score: 70, strengths: ['You communicated your thinking', 'You stayed engaged with the question'], improvement: 'Add sharper evidence and measurable outcomes.' }, finalFeedback: { score: 70, strengths: ['Completed a realistic interview conversation', 'Showed willingness to reflect'], improvements: ['Use specific examples and outcomes', 'Keep answers structured and concise'], nextAction: 'Repeat the interview and strengthen the evidence in every answer.' } } : { done: false, nextQuestion: next, evaluation: { score: 70, strengths: ['You addressed the question'], improvement: 'Add a concrete example or measurable result.' }, finalFeedback: null });
  }
});

app.post('/api/coach', async (req, res) => {
  const { module = 'corporate', context = '', career = 'job' } = req.body || {};
  const prompt = module === 'ai' ? `Create a practical AI-at-work learning sprint for a student entering a ${career === 'internship' ? 'summer internship' : 'corporate role'}. Focus on research, writing, analysis, meetings, automation, verification and responsible use. Return ONLY JSON with diagnosis, workflows (5), promptExamples (5), guardrails (5), sevenDayPlan (7). Context: ${context}` : `Create a practical corporate-readiness micro-plan for a student entering a ${career === 'internship' ? 'summer internship' : 'first full-time role'}. Focus on resilience, stress management, feedback, communication, priorities, boundaries and asking for help. Return ONLY JSON with score, diagnosis, actions (5), weeklyHabit, reflectionQuestion. Student context: ${context}`;
  try { return res.json(await generate(prompt)); } catch { return res.json({ diagnosis: 'Start small: choose one recurring task and make it easier with a repeatable workflow.', actions: ['Plan tomorrow before logging off', 'Clarify priorities with your manager', 'Use a simple task list', 'Ask for feedback early', 'Protect recovery time'], weeklyHabit: '15-minute weekly review', reflectionQuestion: 'What did I learn this week that makes next week easier?' }); }
});

app.post('/api/demo', async (req, res) => {
  const { company = 'Target company', problem = '', idea = '' } = req.body || {};
  if (!problem.trim()) return res.status(400).json({ error: 'Describe the company problem first.' });
  try { return res.json(await generate(`You are a product strategist helping a student impress a corporate interviewer. Analyse the company problem and create a credible product concept. Return ONLY valid JSON with: title, tagline, users, impact, pitch (array of 4 bullets), html. The html must be a complete self-contained polished HTML document, inline CSS only, responsive, no external assets. Company: ${company}. Problem: ${problem}. Candidate idea: ${idea}`)); }
  catch { return res.json({ title: `${company} — ${idea || 'A focused solution'}`, tagline: 'A candidate-built prototype around a real business problem.', users: 'Customers, frontline teams and business owners', impact: 'Reduce friction, improve visibility and create a measurable workflow.', pitch: ['Clear problem-to-solution narrative', 'Designed around a specific user', 'Focused on measurable business impact', 'Ready to discuss with an interviewer'], html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${company} demo</title><style>body{font-family:system-ui;margin:0;background:#f5f7fb;color:#172033}main{max-width:820px;margin:40px auto;padding:32px;background:#fff;border-radius:24px;box-shadow:0 15px 45px #0001}h1{font-size:42px;margin:0 0 10px}p{color:#667085;line-height:1.6}.cta{display:inline-block;background:#172033;color:#fff;padding:13px 18px;border-radius:10px}</style></head><body><main><small>PRODUCT CONCEPT</small><h1>${company}</h1><p>${problem}</p><h2>${idea || 'A simpler digital workflow'}</h2><p>A candidate-built concept that turns the problem into a clear, usable experience.</p><a class="cta">Explore prototype</a></main></body></html>` }); }
});

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
else app.get('*', (req, res) => res.status(200).send('GetJobReady build is being prepared.'));
app.listen(PORT, () => console.log(`GetJobReady running on ${PORT}; Gemini slots=${publicStatus().keySlots}`));
