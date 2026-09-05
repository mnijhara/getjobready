const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { generate, publicStatus } = require('./ai-router.cjs');
const app = express();
const PORT = process.env.PORT || 4173;
const root = __dirname;
// Deployment parity marker: keep the Hostinger Node entrypoint tied to the GitHub build.
const allowedOrigin = (process.env.PUBLIC_BASE_URL || 'https://getjobready.online').replace(/\/$/, '');
app.disable('x-powered-by');
// GetJobReady is normally behind a single trusted reverse proxy. Trust only that
// first hop so req.ip uses the real client address for per-student rate limiting.
app.set('trust proxy', 1);
app.use(cors({ origin: (origin, callback) => { if (!origin || !allowedOrigin || origin === allowedOrigin) return callback(null, true); return callback(null, false); }, methods: ['GET','POST','OPTIONS'], credentials: false }));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','microphone=(self), camera=(), geolocation=()');if(req.path.startsWith('/api/')){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Pragma','no-cache');}next();});
app.use(express.json({ limit: '8mb' }));
const rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 45;
const RATE_MAX_BUCKETS = 5_000;
const cleanupRateBuckets = (now) => { if (rateBuckets.size <= RATE_MAX_BUCKETS) return; for (const [key, bucket] of rateBuckets) { if (now - bucket.start > RATE_WINDOW_MS) rateBuckets.delete(key); if (rateBuckets.size <= RATE_MAX_BUCKETS) break; } };
app.use('/api', (req,res,next)=>{if(req.path==='/health'||req.path==='/ai-status')return next();const now=Date.now();const key=req.ip||req.socket.remoteAddress||'unknown';const bucket=rateBuckets.get(key)||{start:now,count:0};if(now-bucket.start>RATE_WINDOW_MS){bucket.start=now;bucket.count=0;}bucket.count+=1;rateBuckets.set(key,bucket);cleanupRateBuckets(now);if(bucket.count>RATE_LIMIT)return res.status(429).json({error:'Too many requests. Please try again shortly.'});next();});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'getjobready', ai: publicStatus() }));
app.get('/api/ai-status', (req, res) => res.json(publicStatus()));

const analysisPrompt = (cv, jd, career, mode='specific') => mode === 'general'
  ? `You are an expert campus recruiter and CV strategist. Analyse this student's CV WITHOUT assuming a specific job. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in the CV). Questions must test the candidate's actual projects, experience, achievements, strengths, weaknesses, teamwork, ownership, problem solving and behavioural readiness. Do not invent employers, skills, achievements or a target role.\n\nCV:\n${String(cv).slice(0,40000)}`
  : `You are an expert campus recruiter, CV strategist and career coach. Analyse this student's CV against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 role-specific questions). Prioritise evidence, skills, role fit, measurable impact and realistic campus-placement advice.\n\nCV:\n${String(cv).slice(0,40000)}\n\nJOB DESCRIPTION:\n${String(jd).slice(0,30000)}`;

app.post('/api/analyze', async (req, res) => {
  const { cv = '', jd = '', career = 'job', mode = 'specific' } = req.body || {};
  if (!cv.trim() && !jd.trim()) return res.status(400).json({ error: 'CV or job description is required.' });
  try { return res.json(await generate(analysisPrompt(cv, jd, career, mode))); }
  catch (error) { console.error('analyze:', error.message); return res.status(503).json({ error: 'AI analysis is temporarily unavailable. Please retry in a moment.' }); }
});

app.post('/api/analyze-upload', async (req, res) => {
  const { data = '', mime = 'application/pdf', jd = '', career = 'job', mode = 'specific' } = req.body || {};
  if (!data) return res.status(400).json({ error: 'CV file data is required.' });
  if (data.length > 7_000_000) return res.status(413).json({ error: 'CV file is too large. Please keep it under 5 MB.' });
  const allowedMimes = ['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedMimes.includes(mime)) return res.status(415).json({ error: 'Unsupported CV file type.' });
  try {
    const prompt = mode === 'general'
      ? `You are an expert campus recruiter and CV strategist. Read the attached CV WITHOUT assuming a target job. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in this CV). Questions must cover the candidate's actual projects, experience, achievements, teamwork, ownership, problem solving and behavioural readiness. Do not invent facts or assume a role.`
      : `You are an expert campus recruiter. Read the attached CV and analyse it against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7), interviewQuestions (exactly 5 role-specific questions). Target JD:\n${String(jd).slice(0,30000)}`;
    return res.json(await generate('', { parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }));
  } catch (error) { console.error('analyze-upload:', error.message); return res.status(503).json({ error: 'AI analysis is temporarily unavailable. Please retry in a moment.' }); }
});

app.post('/api/interview-feedback', async (req, res) => {
  const { jd = '', answers = [], mode = 'specific', cv = '' } = req.body || {};
  const safeAnswers = Array.isArray(answers) ? answers.slice(-10).map(a=>({question:String(a.question||'').slice(0,1000),answer:String(a.answer||'').slice(0,5000)})) : [];
  const context = mode === 'general'
    ? `GENERAL CV INTERVIEW. Use the candidate CV as the preparation context:\n${String(cv).slice(0,40000)}`
    : `ROLE-SPECIFIC CV + JD INTERVIEW. Use BOTH sources when evaluating evidence, relevance and fit.\n\nCANDIDATE CV:\n${String(cv).slice(0,40000)}\n\nTARGET JD:\n${String(jd).slice(0,30000)}`;
  try { return res.json(await generate(`You are a demanding but supportive campus interviewer. Evaluate these interview answers. Return ONLY valid JSON with exactly: score (0-100), strengths (max 4), improvements (max 4), nextAction. Assess clarity, structure, evidence, ownership, relevance, communication, confidence and business thinking.\n\n${context}\n\nANSWERS:\n${JSON.stringify(safeAnswers)}`)); }
  catch (error) { console.error('interview-feedback:', error.message); return res.status(503).json({ error: 'Interview feedback is temporarily unavailable. Please retry in a moment.' }); }
});

app.post('/api/interview-turn', async (req, res) => {
  const { jd = '', cv = '', cvData = '', cvMime = '', mode = 'specific', career = 'job', question = '', answer = '', history = [], turn = 1, maxTurns = 7 } = req.body || {};
  if (!question.trim() || !answer.trim()) return res.status(400).json({ error: 'Question and answer are required.' });
  const safeTurn = Math.min(7, Math.max(1, Number(turn)||1)); const safeMax = Math.min(7, Math.max(3, Number(maxTurns)||7));
  const context = mode === 'general'
    ? `GENERAL CV INTERVIEW. The questions must be grounded in the candidate CV and general interview competencies. Candidate CV text (when available):\n${String(cv).slice(0,40000)}`
    : `ROLE-SPECIFIC CV + JD INTERVIEW. Target job description:\n${String(jd).slice(0,30000)}\nCandidate CV context:\n${String(cv).slice(0,40000)}`;
  const prompt = `You are conducting a realistic campus-to-corporate voice interview for a ${career === 'internship' ? 'summer internship' : 'full-time role'}. This is a live conversation, not a questionnaire. Evaluate the candidate's latest spoken answer, decide whether to probe deeper or move to a new competency, and ask exactly ONE concise next question when continuing. Be natural and progressively harder. ${mode === 'general' ? 'For this general interview, base questions on the candidate CV and general interview readiness; do not assume a target role or invent facts.' : 'For this role-specific interview, every question must connect the CV evidence to the JD requirements, with role-specific follow-ups.'} Do not repeat questions. If the candidate gives a vague claim, ask for evidence; if they give a strong example, probe impact or learning. After ${safeMax} turns, end the interview. Return ONLY JSON with exactly: done (boolean), nextQuestion (string), evaluation (object with score 0-100, strengths array max 2, improvement string), finalFeedback (object or null). If done=true, nextQuestion must be empty and finalFeedback must contain score (0-100), strengths (max 4), improvements (max 4), nextAction. If done=false, finalFeedback must be null.\n\n${context}\n\nTURN ${safeTurn} OF ${safeMax}\nCURRENT QUESTION:\n${String(question).slice(0,1500)}\n\nCANDIDATE ANSWER:\n${String(answer).slice(0,7000)}\n\nPREVIOUS TURNS:\n${JSON.stringify(Array.isArray(history)?history.slice(-8):[]).slice(0,12000)}`;
  try {
    const parts = cvData && cvMime ? [{ text: prompt }, { inlineData: { mimeType: cvMime, data: cvData } }] : [{ text: prompt }];
    const data = await generate(prompt, { parts, maxOutputTokens: 2500 });
    if (!data || typeof data !== 'object') throw new Error('Invalid interview turn');
    if (safeTurn >= safeMax) data.done = true;
    return res.json(data);
  } catch (error) {
    console.error('interview-turn:', error.message);
    return res.status(503).json({ error: 'The AI interviewer is temporarily unavailable. Your answer was not scored. Please retry this turn.' });
  }
});

app.post('/api/coach', async (req, res) => {
  const { module = 'corporate', context = '', career = 'job' } = req.body || {};
  const prompt = module === 'ai' ? `Create a practical AI-at-work learning sprint for a student entering a ${career === 'internship' ? 'summer internship' : 'corporate role'}. Focus on research, writing, analysis, meetings, automation, verification and responsible use. Return ONLY JSON with diagnosis, workflows (5), promptExamples (5), guardrails (5), sevenDayPlan (7). Context: ${String(context).slice(0,12000)}` : `Create a practical corporate-readiness micro-plan for a student entering a ${career === 'internship' ? 'summer internship' : 'first full-time role'}. Focus on resilience, stress management, feedback, communication, priorities, boundaries and asking for help. Return ONLY JSON with score, diagnosis, actions (5), weeklyHabit, reflectionQuestion. Student context: ${String(context).slice(0,12000)}`;
  try { return res.json(await generate(prompt)); } catch (error) { console.error('coach:', error.message); return res.status(503).json({ error: 'AI coaching is temporarily unavailable. Please retry in a moment.' }); }
});

app.post('/api/aimentor', async (req, res) => {
  const body = req.body || {};
  const message = String(body.message || body.candidateMessage || body.userMessage || '').trim();
  const history = body.history || body.messages || [];
  const career = body.career || 'job';
  const cv = body.cv || '';
  const topic = body.topic || 'general';

  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const prompt = `You are Alex Rivera, Principal AI Workflow Strategist & Enterprise AI Mentor at GetJobReady.
Your mission is to guide a student or early-career candidate entering a ${career === 'internship' ? 'summer internship' : 'corporate job'} on how to use generative AI (ChatGPT, Claude, Microsoft Copilot, Cursor) effectively and responsibly in their daily work, and how they can learn more.

Candidate Context (CV/Profile):
${cv ? String(cv).slice(0, 4000) : 'General student / early career candidate'}

Recent discussion history:
${JSON.stringify(Array.isArray(history) ? history.slice(-6) : [])}

The student just asked or said:
"${String(message).slice(0, 3000)}"

Respond with elite, practical, enterprise-grade mentorship.
Return ONLY valid JSON with exactly these fields:
- reply: (string) Your direct, encouraging, and actionable response (3-4 concise paragraphs max). Explain the strategy, recommended tooling, how to structure the workflow, and what mistakes to avoid.
- recommendedPrompt: (string) A production-grade copyable prompt template with clear bracketed placeholders [like this] that they can paste directly into ChatGPT or Claude.
- keyTakeaways: (array of 2-3 strings) Short, punchy rules or principles (e.g. "Always use Context + Task + Constraints + Format").
- recommendedCourse: (string) Specific course recommendation (e.g. "DeepLearning.AI: Generative AI for Everyone (Coursera)" or "Vanderbilt University: Prompt Engineering for ChatGPT").
- nextQuestion: (string) A proactive follow-up question to help them deepen their AI skills.`;

  try {
    const data = await generate(prompt, { maxOutputTokens: 2000 });
    if (!data || typeof data !== 'object') throw new Error('Invalid AI mentor response');
    return res.json({
      reply: data.reply || "Here is how you can approach this with modern AI workflows.",
      recommendedPrompt: data.recommendedPrompt || "",
      keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : ["Structure prompts with Context, Task, and Constraints.", "Always verify numbers and calculations independently."],
      recommendedCourse: data.recommendedCourse || "DeepLearning.AI: Generative AI for Everyone (Coursera)",
      nextQuestion: data.nextQuestion || "What specific project or document would you like to automate next?"
    });
  } catch (error) {
    console.error('aimentor:', error.message);
    const lower = message.toLowerCase();
    let reply = "Generative AI can 3x your productivity when applied to repetitive drafting, synthesis, and structured analysis. The key is never treating the model as an oracle, but rather as a brilliant junior analyst that requires clear context, precise constraints, and independent verification.";
    let promptTemplate = `Act as an expert business consultant. Review the following notes and draft an executive synthesis using the Situation, Complication, Question, and Answer (SCQA) framework. Notes: [insert your rough notes here]. Keep recommendations prioritized with estimated business impact.`;
    let takeaways = [
      "Use the CTC-F model: Context, Task, Constraints, and Format.",
      "Never paste unredacted confidential company data into public models.",
      "Human in the loop: you remain 100% accountable for every number and fact."
    ];
    let course = "DeepLearning.AI: Generative AI for Everyone by Andrew Ng";
    let nextQ = "Would you like to explore an executive memo prompt or meeting transcript summarization next?";

    if (lower.includes('course') || lower.includes('learn') || lower.includes('start') || lower.includes('certif')) {
      reply = "To build a rock-solid foundation in workplace AI, start with Andrew Ng's 'Generative AI for Everyone' on Coursera (100% free audit) to understand foundational capabilities and limitations. Next, complete Vanderbilt University's 'Prompt Engineering for ChatGPT' to master advanced prompt design patterns, and earn Microsoft's free 'Career Essentials in Generative AI' certificate on LinkedIn Learning.";
      promptTemplate = `Act as a senior learning coach. Help me design a 14-day study sprint to master prompt engineering and AI workflow automation for my upcoming [insert role/industry]. Include daily 30-minute practice tasks and verification milestones.`;
      takeaways = [
        "Audit free courses on Coursera (select 'Audit course' to access all videos and materials for $0).",
        "Practice building 1 real workflow daily instead of just passively watching videos.",
        "Add verified credentials to your LinkedIn profile to signal forward-thinking agility."
      ];
      course = "Vanderbilt University: Prompt Engineering for ChatGPT (Coursera)";
      nextQ = "Are you looking to focus more on non-technical business workflows (writing/strategy) or technical workflows (coding/data analysis)?";
    } else if (lower.includes('memo') || lower.includes('writ') || lower.includes('scqa') || lower.includes('draft')) {
      reply = "For high-stakes executive writing, never ask AI to simply 'write a memo'. High-performing professionals use the SCQA framework (Situation, Complication, Key Question, and Answer) combined with strict length and tone constraints to eliminate fluff.";
      promptTemplate = `Act as an engagement manager at McKinsey. Convert the following bullet points into a crisp 1-page executive brief for senior leadership. Use the SCQA framework: Situation, Complication, Key Question, and Answer. Focus ruthlessly on bottom-line decisions and include a risk mitigation table. Input: [paste data].`;
      takeaways = [
        "Supply a strong reference persona and target audience.",
        "Set strict negative constraints (e.g. 'No corporate buzzwords or vague filler').",
        "Request alternative recommendation angles to stress-test your thinking."
      ];
      course = "University of Leeds: Communication and Interpersonal Skills at Work (FutureLearn)";
      nextQ = "Would you like to see how to adapt this prompt for a weekly Friday manager update?";
    } else if (lower.includes('meeting') || lower.includes('raci') || lower.includes('transcript') || lower.includes('notes')) {
      reply = "Transforming messy meeting transcripts into structured action tables is one of the highest-leverage AI workflows. The model excels at clustering dialogue into decisions, open risks, and strict RACI accountability matrices.";
      promptTemplate = `I have pasted the raw transcript of a team alignment meeting below. Extract: 1. Decisions agreed upon, 2. Key open questions or roadblocks, 3. A Markdown RACI table with columns: Action Item, Responsible Owner, Accountable Stakeholder, Deadline. Transcript: [paste transcript].`;
      takeaways = [
        "Instruct the model to distinguish between 'agreed decisions' and 'informal suggestions'.",
        "Always demand a table format with clear ownership columns.",
        "Verify timestamps and speaker names against the original recording."
      ];
      course = "Google: Project Execution: Running the Project & Managing Risk (Coursera)";
      nextQ = "Do your team meetings usually happen on Zoom, Teams, or Google Meet?";
    } else if (lower.includes('data') || lower.includes('excel') || lower.includes('anomal') || lower.includes('outlier')) {
      reply = "When analyzing spreadsheets and metrics with AI, use Python-assisted analysis (like Advanced Data Analysis in ChatGPT or Claude Artifacts). Always prompt the model to inspect column distributions, calculate percentage variances, and generate hypothesis explanations for anomalies.";
      promptTemplate = `I have provided tabular business performance data below. 1. Identify the top 3 statistical outliers or week-over-week drops. 2. Calculate variance percentages for key KPIs. 3. Formulate 3 testable business hypotheses that could explain these variances. Data: [paste tabular rows].`;
      takeaways = [
        "Ask the model to show the exact formula or code used to calculate metrics.",
        "Spot-check summary totals manually before presenting to stakeholders.",
        "Pair anomaly detection with qualitative hypotheses for executive impact."
      ];
      course = "Harvard CS50: Introduction to Artificial Intelligence with Python (edX)";
      nextQ = "What type of data are you working with — sales, marketing, finance, or operations?";
    }

    return res.json({
      reply,
      recommendedPrompt: promptTemplate,
      keyTakeaways: takeaways,
      recommendedCourse: course,
      nextQuestion: nextQ
    });
  }
});

app.post('/api/roleplay', async (req, res) => {
  const body = req.body || {};
  const message = String(body.message || body.candidateMessage || '').trim();
  const scenario = String(body.scenario || body.scenarioId || 'criticism');
  const history = body.history || body.messages || [];
  const career = body.career || 'job';
  const cv = body.cv || '';
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  
  const scenarios = {
    criticism: {
      persona: 'Vikram Mehta (Director of Operations / Practice Lead)',
      context: 'Critical manager feedback dilemma. You gave sharp, urgent feedback on a deliverable that lacks depth and data citations. The student is answering you.'
    },
    'critical-feedback': {
      persona: 'Vikram Mehta (Director of Operations / Practice Lead)',
      context: 'Critical manager feedback dilemma. You gave sharp, urgent feedback on a deliverable that lacks depth and data citations. The student is answering you.'
    },
    bandwidth: {
      persona: 'Sarah Chen (Senior Product Manager & Core Stakeholder)',
      context: 'Overloaded bandwidth dilemma. You urgently asked the student to drop their priorities and compile an unvetted 10-page competitor benchmark deck by 4 PM.'
    },
    'overloaded-bandwidth': {
      persona: 'Sarah Chen (Senior Product Manager & Core Stakeholder)',
      context: 'Overloaded bandwidth dilemma. You urgently asked the student to drop their priorities and compile an unvetted 10-page competitor benchmark deck by 4 PM.'
    },
    pushback: {
      persona: 'Rajesh Nair (VP of Commercial Operations)',
      context: 'Public stakeholder pushback dilemma. You challenged their sales cycle recommendations claiming assumptions were theoretical and customer realities were ignored.'
    },
    'cross-functional-pushback': {
      persona: 'Rajesh Nair (VP of Commercial Operations)',
      context: 'Public stakeholder pushback dilemma. You challenged their sales cycle recommendations claiming assumptions were theoretical and customer realities were ignored.'
    },
    setback: {
      persona: 'Elena Rostova (Head of Client Engagements / Partner)',
      context: 'First milestone missed dilemma. The weekly synthesis report was not delivered to the client by 9 AM and the partner heard from the client first.'
    },
    'missed-deadline': {
      persona: 'Elena Rostova (Head of Client Engagements / Partner)',
      context: 'First milestone missed dilemma. The weekly synthesis report was not delivered to the client by 9 AM and the partner heard from the client first.'
    }
  };
  
  const activeScenario = scenarios[scenario] || scenarios.criticism;
  const prompt = `You are running an interactive corporate resilience role-play training for a student in their ${career === 'internship' ? 'first internship' : 'first full-time corporate role'}.
You are roleplaying as: ${activeScenario.persona}.
Scenario Context: ${activeScenario.context}

Recent conversation history:
${JSON.stringify(Array.isArray(history) ? history.slice(-6) : [])}

The student just replied:
"${String(message).slice(0, 3000)}"

Respond in character as ${activeScenario.persona}, while evaluating their emotional resilience, composure, ownership, and diplomacy.
Return ONLY valid JSON with exactly these fields:
- characterReply: (string) Your in-character response (2-3 sentences max). Stay realistic and firm but professional. If the student offered a clear, structured solution and took ownership without defensiveness, acknowledge it and guide toward next steps. If they were defensive, vague, or overly apologetic, press them constructively.
- resilienceScore: (integer 0-100) How well they stayed calm, objective, and non-defensive under pressure.
- diplomacyScore: (integer 0-100) Professionalism, tact, and constructive solution-focus.
- whatWorked: (string) Specific strong element in their phrasing or attitude (1 sentence).
- whatToImprove: (string) Constructive advice on what sounded defensive, weak, or unclear (1 sentence).
- recommendedScript: (string) The exact executive word-for-word rephrase they could have used instead.
- frameworkTip: (string) Practical resilience framework tip (e.g. ABCD model, Separating self from work, Trade-off matrix).
- done: (boolean) true if the situation reached an agreed resolution, false if another turn is needed.`;

  try {
    const data = await generate(prompt, { maxOutputTokens: 1800 });
    if (!data || typeof data !== 'object') throw new Error('Invalid roleplay response');
    const reply = data.characterReply || data.reply || '';
    const recScript = data.recommendedScript || data.executiveScript || '';
    const frameTip = data.frameworkTip || data.reframingTip || '';
    const rScore = Number(data.resilienceScore || data.score || 80);
    const dScore = Number(data.diplomacyScore || Math.min(100, rScore + 4));
    const coaching = {
      score: rScore,
      resilienceScore: rScore,
      diplomacyScore: dScore,
      whatWorked: data.whatWorked || 'Constructive communication.',
      whatToImprove: data.whatToImprove || 'Ensure a clear timeline is provided.',
      executiveScript: recScript,
      reframingTip: frameTip
    };
    return res.json({
      ...data,
      characterReply: reply,
      reply,
      recommendedScript: recScript,
      executiveScript: recScript,
      frameworkTip: frameTip,
      reframingTip: frameTip,
      resilienceScore: rScore,
      diplomacyScore: dScore,
      score: rScore,
      coaching
    });
  } catch (error) {
    console.error('roleplay:', error.message);
    const isDefensive = /not my fault|you didn't|wasn't me|confused by your|blame/i.test(message);
    const acknowledges = /thank you|appreciate|ownership|fix|update|priority|by \d|pm|am/i.test(message);
    const score = acknowledges && !isDefensive ? 85 : isDefensive ? 45 : 70;
    const replyText = acknowledges
      ? "I appreciate you addressing this head-on. Let's make sure the revised numbers are updated and verified. Please send me the updated draft before 3:45 PM so we can do a final review before leadership joins."
      : "I hear your explanation, but right now the client partner is walking into that room in 45 minutes. What is the immediate contingency plan to get these deliverables client-ready?";
    const script = '"Thank you for pointing that out clearly. I take full ownership. Here is what I will adjust immediately to prevent this, and I will share an updated draft by 4 PM for your quick review."';
    const tip = "The ABCD Model: Separate your personal identity from the draft deliverable. Criticism of work is an invitation to refine the output.";
    const coaching = {
      score,
      resilienceScore: score,
      diplomacyScore: Math.min(95, score + 5),
      whatWorked: acknowledges ? "You focused on the deliverable and offered a proactive timeline." : "You responded promptly to the critique.",
      whatToImprove: isDefensive ? "Avoid defensive explanations that shift blame; focus immediately on what can be adjusted now." : "State an exact time commitment for when the revised version will be in their inbox.",
      executiveScript: script,
      reframingTip: tip
    };

    return res.json({
      characterReply: replyText,
      reply: replyText,
      resilienceScore: score,
      diplomacyScore: Math.min(95, score + 5),
      score,
      whatWorked: coaching.whatWorked,
      whatToImprove: coaching.whatToImprove,
      recommendedScript: script,
      executiveScript: script,
      frameworkTip: tip,
      reframingTip: tip,
      coaching,
      done: acknowledges && !isDefensive
    });
  }
});

app.post('/api/demo', async (req, res) => {
  const { company = 'Target company', problem = '', idea = '' } = req.body || {};
  if (!problem.trim()) return res.status(400).json({ error: 'Describe the company problem first.' });
  try { return res.json(await generate(`You are a product strategist helping a student impress a corporate interviewer. Analyse the company problem and create a credible product concept. Return ONLY valid JSON with: title, tagline, users, impact, pitch (array of 4 bullets), html. The html must be a complete self-contained polished interactive HTML document, inline CSS only, responsive, no external assets. It must include an interactive "Simulate Workflow" button with an inline <script> that demonstrates an in-page animated workflow progression, updating DOM status, logs, or metrics visually when clicked (do NOT use alert()). Company: ${String(company).slice(0,500)}. Problem: ${String(problem).slice(0,12000)}. Candidate idea: ${String(idea).slice(0,5000)}`)); }
  catch (error) { console.error('demo:', error.message); return res.status(503).json({ error: 'AI prototype generation is temporarily unavailable. Please retry in a moment.' }); }
});

app.get(/^\/pdf\.worker(?:-[^/]+)?\.mjs$/, (req, res) => {
  const worker = path.join(root, 'dist', 'pdf.worker.mjs');
  if (!fs.existsSync(worker)) return res.status(503).type('text/plain').send('PDF worker is not available in this deployment.');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  return res.sendFile(worker);
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (err instanceof SyntaxError && err?.status === 400 && Object.prototype.hasOwnProperty.call(err, 'body')) return res.status(400).json({ error: 'Invalid JSON request body.' });
  console.error('request:', err?.message || 'Unexpected request error');
  return res.status(500).json({ error: 'Unexpected server error.' });
});

app.use(express.static(root));
app.get('*', (req,res) => { const index = fs.existsSync(path.join(root,'index.html')) ? 'index.html' : 'index.src.html'; res.sendFile(path.join(root,index)); });
app.listen(PORT, () => console.log(`GetJobReady listening on ${PORT}`));