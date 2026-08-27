var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// ai-router.cjs
var require_ai_router = __commonJS({
  "ai-router.cjs"(exports2, module2) {
    var DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
    var WORKER_URL = (process.env.AI_PROXY_URL || "https://getjobready-ai-proxy.mnijhara.workers.dev").replace(/\/$/, "");
    var GENERATE_URL = `${WORKER_URL}/generate`;
    var workerFailures = 0;
    var workerCooldownUntil = 0;
    var workerRequests = 0;
    var lastWorkerUse = 0;
    function configured() {
      return Boolean(WORKER_URL);
    }
    function publicStatus2() {
      const healthy = Date.now() >= workerCooldownUntil;
      return {
        configured: configured(),
        keySlots: configured() ? 5 : 0,
        healthySlots: configured() && healthy ? 5 : 0,
        model: DEFAULT_MODEL,
        router: "Cloudflare 5-key round-robin + automatic failover",
        proxy: WORKER_URL,
        requests: workerRequests,
        lastRequestAt: lastWorkerUse || null
      };
    }
    function markFailure(status) {
      workerFailures += 1;
      const seconds = status === 429 ? Math.min(90, 10 * workerFailures) : status === 401 || status === 403 ? 300 : 15;
      workerCooldownUntil = Date.now() + seconds * 1e3;
    }
    function markSuccess() {
      workerFailures = 0;
      workerCooldownUntil = 0;
    }
    function parseJson(text) {
      const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      try {
        return JSON.parse(cleaned);
      } catch {
        throw new Error("Gemini returned invalid JSON");
      }
    }
    function extractText(data) {
      if (typeof data === "string") return data;
      if (data?.candidates?.[0]?.content?.parts) return data.candidates[0].content.parts.map((p) => p.text || "").join("");
      if (typeof data?.text === "string") return data.text;
      if (typeof data?.output === "string") return data.output;
      if (typeof data?.response === "string") return data.response;
      if (typeof data?.result === "string") return data.result;
      if (data?.result && typeof data.result === "object") return JSON.stringify(data.result);
      return "";
    }
    var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function generate2(prompt, options = {}) {
      if (!configured()) throw Object.assign(new Error("AI_NOT_CONFIGURED"), { code: "AI_NOT_CONFIGURED" });
      if (Date.now() < workerCooldownUntil) throw new Error("AI_PROXY_COOLDOWN");
      const suppliedParts = options.parts || [{ text: prompt }];
      const parts = suppliedParts.filter((part, index) => !(index === 0 && part?.text === prompt));
      const model = options.model || DEFAULT_MODEL;
      const generationConfig = {
        responseMimeType: options.responseMimeType || "application/json",
        maxOutputTokens: options.maxOutputTokens || 6e3
      };
      const body = {
        prompt,
        model,
        contents: parts.length ? [{ parts }] : [],
        generationConfig,
        json: options.json !== false
      };
      workerRequests += 1;
      lastWorkerUse = Date.now();
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(GENERATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            const retryable = response.status === 429 || response.status >= 500;
            if (retryable && attempt < maxAttempts) {
              await sleep(response.status === 429 ? 250 * attempt : 150 * attempt);
              continue;
            }
            markFailure(response.status);
            throw new Error(`AI proxy ${response.status}: ${errorBody.slice(0, 300)}`);
          }
          const data = await response.json();
          const text = extractText(data);
          if (!text) {
            if (data && typeof data === "object" && !Array.isArray(data)) {
              markSuccess();
              return options.json === false ? JSON.stringify(data) : data;
            }
            throw new Error("AI proxy returned an empty response");
          }
          markSuccess();
          return options.json === false ? text : parseJson(text);
        } catch (error) {
          const message = String(error.message || "");
          const retryableNetwork = !message.startsWith("AI proxy ") && attempt < maxAttempts;
          if (retryableNetwork) {
            await sleep(150 * attempt);
            continue;
          }
          if (!message.startsWith("AI proxy ")) markFailure(500);
          throw error;
        }
      }
      throw new Error("AI proxy request failed");
    }
    module2.exports = { generate: generate2, publicStatus: publicStatus2, configured };
  }
});

// server.cjs
var express = require("express");
var path = require("path");
var fs = require("fs");
var cors = require("cors");
var { generate, publicStatus } = require_ai_router();
var app = express();
var PORT = process.env.PORT || 4173;
var root = __dirname;
var allowedOrigin = process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/$/, "") : null;
app.disable("x-powered-by");
app.use(cors({ origin: (origin, callback) => {
  if (!origin || !allowedOrigin || origin === allowedOrigin) return callback(null, true);
  return callback(null, false);
}, methods: ["GET", "POST", "OPTIONS"], credentials: false }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "8mb" }));
var rateBuckets = /* @__PURE__ */ new Map();
var RATE_WINDOW_MS = 6e4;
var RATE_LIMIT = 45;
var RATE_MAX_BUCKETS = 5e3;
var cleanupRateBuckets = (now) => {
  if (rateBuckets.size <= RATE_MAX_BUCKETS) return;
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.start > RATE_WINDOW_MS) rateBuckets.delete(key);
    if (rateBuckets.size <= RATE_MAX_BUCKETS) break;
  }
};
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/ai-status") return next();
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > RATE_WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  cleanupRateBuckets(now);
  if (bucket.count > RATE_LIMIT) return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  next();
});
var fallback = { score: 58, headline: "You have a base \u2014 now make it role-specific.", summary: "Use the role requirements to sharpen your story, evidence and interview practice.", highlights: ["Your profile has transferable strengths", "Academic and project work can become strong evidence", "Focused practice will improve interview confidence"], gaps: ["Add measurable outcomes to important CV bullets", "Prepare STAR stories mapped to the role", "Research the company and role before interviewing"], cvImprovements: ["Lead bullets with action + outcome", "Quantify scope, impact or scale wherever possible", "Move the most relevant skills and projects higher"], rewrittenBullets: ["Led a project that improved a measurable business outcome by using a structured approach.", "Collaborated with a cross-functional team to deliver a project within the agreed timeline."], plan: ["Rewrite your top 3 CV bullets around outcomes", "Prepare a 90-second introduction", "Build 3 STAR stories from projects or internships", "Research the company and role", "Practise 5 role-specific questions", "Complete a timed mock interview", "Review feedback and repeat"], interviewQuestions: ["Tell me about yourself and why this role?", "Walk me through a project where you solved a difficult problem.", "What is your strongest evidence that you can succeed in this role?", "Tell me about a time you received difficult feedback.", "What would you do in your first 30 days?"] };
app.get("/api/health", (req, res) => res.json({ ok: true, service: "getjobready", ai: publicStatus() }));
app.get("/api/ai-status", (req, res) => res.json(publicStatus()));
var analysisPrompt = (cv, jd, career, mode = "specific") => mode === "general" ? `You are an expert campus recruiter and CV strategist. Analyse this student's CV WITHOUT assuming a specific job. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in the CV). Questions must test the candidate's actual projects, experience, achievements, strengths, weaknesses, teamwork, ownership, problem solving and behavioural readiness. Do not invent employers, skills, achievements or a target role.

CV:
${String(cv).slice(0, 4e4)}` : `You are an expert campus recruiter, CV strategist and career coach. Analyse this student's CV against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 role-specific questions). Prioritise evidence, skills, role fit, measurable impact and realistic campus-placement advice.

CV:
${String(cv).slice(0, 4e4)}

JOB DESCRIPTION:
${String(jd).slice(0, 3e4)}`;
app.post("/api/analyze", async (req, res) => {
  const { cv = "", jd = "", career = "job", mode = "specific" } = req.body || {};
  if (!cv.trim() && !jd.trim()) return res.status(400).json({ error: "CV or job description is required." });
  try {
    return res.json(await generate(analysisPrompt(cv, jd, career, mode)));
  } catch (error) {
    console.error("analyze:", error.message);
    return res.json(fallback);
  }
});
app.post("/api/analyze-upload", async (req, res) => {
  const { data = "", mime = "application/pdf", name = "CV", jd = "", career = "job", mode = "specific" } = req.body || {};
  if (!data) return res.status(400).json({ error: "CV file data is required." });
  if (data.length > 7e6) return res.status(413).json({ error: "CV file is too large. Please keep it under 5 MB." });
  const allowedMimes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowedMimes.includes(mime)) return res.status(415).json({ error: "Unsupported CV file type." });
  try {
    const prompt = mode === "general" ? `You are an expert campus recruiter and CV strategist. Read the attached CV WITHOUT assuming a target job. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in this CV). Questions must cover the candidate's actual projects, experience, achievements, teamwork, ownership, problem solving and behavioural readiness. Do not invent facts or assume a role.` : `You are an expert campus recruiter. Read the attached CV and analyse it against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7), interviewQuestions (exactly 5 role-specific questions). Target JD:
${String(jd).slice(0, 3e4)}`;
    return res.json(await generate("", { parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }));
  } catch (error) {
    console.error("analyze-upload:", error.message);
    return res.json(fallback);
  }
});
app.post("/api/interview-feedback", async (req, res) => {
  const { jd = "", answers = [], mode = "specific", cv = "" } = req.body || {};
  const safeAnswers = Array.isArray(answers) ? answers.slice(-10).map((a) => ({ question: String(a.question || "").slice(0, 1e3), answer: String(a.answer || "").slice(0, 5e3) })) : [];
  const context = mode === "general" ? `GENERAL CV INTERVIEW. Use the candidate CV as the preparation context:
${String(cv).slice(0, 4e4)}` : `ROLE-SPECIFIC CV + JD INTERVIEW. Use BOTH sources when evaluating evidence, relevance and fit.

CANDIDATE CV:
${String(cv).slice(0, 4e4)}

TARGET JD:
${String(jd).slice(0, 3e4)}`;
  try {
    return res.json(await generate(`You are a demanding but supportive campus interviewer. Evaluate these interview answers. Return ONLY valid JSON with exactly: score (0-100), strengths (max 4), improvements (max 4), nextAction. Assess clarity, structure, evidence, ownership, relevance, communication, confidence and business thinking.

${context}

ANSWERS:
${JSON.stringify(safeAnswers)}`));
  } catch (error) {
    const words = safeAnswers.reduce((n, a) => n + a.answer.trim().split(/\s+/).filter(Boolean).length, 0);
    return res.json({ score: Math.min(94, Math.max(62, 68 + Math.min(18, Math.floor(words / 35)))), strengths: ["You completed the full interview", "Your answers show preparation and intent", "You demonstrated willingness to reflect"], improvements: ["Use Situation \u2192 Action \u2192 Result", "Add numbers, scope or concrete evidence", "Lead with the outcome and keep context concise"], nextAction: "Repeat the interview and make every example end with a clear result and learning." });
  }
});
app.post("/api/interview-turn", async (req, res) => {
  const { jd = "", cv = "", cvData = "", cvMime = "", mode = "specific", career = "job", question = "", answer = "", history = [], turn = 1, maxTurns = 7 } = req.body || {};
  if (!question.trim() || !answer.trim()) return res.status(400).json({ error: "Question and answer are required." });
  const safeTurn = Math.min(7, Math.max(1, Number(turn) || 1));
  const safeMax = Math.min(7, Math.max(3, Number(maxTurns) || 7));
  const context = mode === "general" ? `GENERAL CV INTERVIEW. The questions must be grounded in the candidate CV and general interview competencies. Candidate CV text (when available):
${String(cv).slice(0, 4e4)}` : `ROLE-SPECIFIC CV + JD INTERVIEW. Target job description:
${String(jd).slice(0, 3e4)}
Candidate CV context:
${String(cv).slice(0, 4e4)}`;
  const prompt = `You are conducting a realistic campus-to-corporate voice interview for a ${career === "internship" ? "summer internship" : "full-time role"}. This is a live conversation, not a questionnaire. Evaluate the candidate's latest spoken answer, decide whether to probe deeper or move to a new competency, and ask exactly ONE concise next question when continuing. Be natural and progressively harder. ${mode === "general" ? "For this general interview, base questions on the candidate CV and general interview readiness; do not assume a target role or invent facts." : "For this role-specific interview, every question must connect the CV evidence to the JD requirements, with role-specific follow-ups."} Do not repeat questions. If the candidate gives a vague claim, ask for evidence; if they give a strong example, probe impact or learning. After ${safeMax} turns, end the interview. Return ONLY JSON with exactly: done (boolean), nextQuestion (string), evaluation (object with score 0-100, strengths array max 2, improvement string), finalFeedback (object or null). If done=true, nextQuestion must be empty and finalFeedback must contain score (0-100), strengths (max 4), improvements (max 4), nextAction. If done=false, finalFeedback must be null.

${context}

TURN ${safeTurn} OF ${safeMax}
CURRENT QUESTION:
${String(question).slice(0, 1500)}

CANDIDATE ANSWER:
${String(answer).slice(0, 7e3)}

PREVIOUS TURNS:
${JSON.stringify(Array.isArray(history) ? history.slice(-8) : []).slice(0, 12e3)}`;
  try {
    const parts = cvData && cvMime ? [{ text: prompt }, { inlineData: { mimeType: cvMime, data: cvData } }] : [{ text: prompt }];
    const data = await generate(prompt, { parts, maxOutputTokens: 2500 });
    if (!data || typeof data !== "object") throw new Error("Invalid interview turn");
    if (safeTurn >= safeMax) data.done = true;
    return res.json(data);
  } catch (error) {
    console.error("interview-turn:", error.message);
    const fallbackQuestions = mode === "general" ? ["Tell me about a project on your CV that you are most proud of.", "Which achievement on your CV best demonstrates ownership?", "Tell me about a difficult problem you solved and what you learned.", "Describe a time you worked with someone who disagreed with you."] : ["Tell me about a project where you had to influence someone without authority.", "What would you do if your manager gave you two urgent priorities at the same time?", "Tell me about a failure or setback and what changed afterwards.", "Why should we choose you over another candidate with similar academic credentials?"];
    const next = fallbackQuestions[Math.min(safeTurn - 1, fallbackQuestions.length - 1)];
    return res.json(safeTurn >= safeMax ? { done: true, nextQuestion: "", evaluation: { score: 70, strengths: ["You communicated your thinking", "You stayed engaged with the question"], improvement: "Add sharper evidence and measurable outcomes." }, finalFeedback: { score: 70, strengths: ["Completed a realistic interview conversation", "Showed willingness to reflect"], improvements: ["Use specific examples and outcomes", "Keep answers structured and concise"], nextAction: "Repeat the interview and strengthen the evidence in every answer." } } : { done: false, nextQuestion: next, evaluation: { score: 70, strengths: ["You addressed the question"], improvement: "Add a concrete example or measurable result." }, finalFeedback: null });
  }
});
app.post("/api/coach", async (req, res) => {
  const { module: module2 = "corporate", context = "", career = "job" } = req.body || {};
  const prompt = module2 === "ai" ? `Create a practical AI-at-work learning sprint for a student entering a ${career === "internship" ? "summer internship" : "corporate role"}. Focus on research, writing, analysis, meetings, automation, verification and responsible use. Return ONLY JSON with diagnosis, workflows (5), promptExamples (5), guardrails (5), sevenDayPlan (7). Context: ${String(context).slice(0, 12e3)}` : `Create a practical corporate-readiness micro-plan for a student entering a ${career === "internship" ? "summer internship" : "first full-time role"}. Focus on resilience, stress management, feedback, communication, priorities, boundaries and asking for help. Return ONLY JSON with score, diagnosis, actions (5), weeklyHabit, reflectionQuestion. Student context: ${String(context).slice(0, 12e3)}`;
  try {
    return res.json(await generate(prompt));
  } catch {
    return res.json({ diagnosis: "Start small: choose one recurring task and make it easier with a repeatable workflow.", actions: ["Plan tomorrow before logging off", "Clarify priorities with your manager", "Use a simple task list", "Ask for feedback early", "Protect recovery time"], weeklyHabit: "15-minute weekly review", reflectionQuestion: "What did I learn this week that makes next week easier?" });
  }
});
app.post("/api/demo", async (req, res) => {
  const { company = "Target company", problem = "", idea = "" } = req.body || {};
  if (!problem.trim()) return res.status(400).json({ error: "Describe the company problem first." });
  try {
    return res.json(await generate(`You are a product strategist helping a student impress a corporate interviewer. Analyse the company problem and create a credible product concept. Return ONLY valid JSON with: title, tagline, users, impact, pitch (array of 4 bullets), html. The html must be a complete self-contained polished HTML document, inline CSS only, responsive, no external assets. Company: ${String(company).slice(0, 500)}. Problem: ${String(problem).slice(0, 12e3)}. Candidate idea: ${String(idea).slice(0, 5e3)}`));
  } catch {
    return res.json({ title: `${company} \u2014 ${idea || "A focused solution"}`, tagline: "A candidate-built prototype around a real business problem.", users: "Customers, frontline teams and business owners", impact: "Reduce friction, improve visibility and create a measurable workflow.", pitch: ["Clear problem-to-solution narrative", "Designed around a specific user", "Focused on measurable business impact", "Ready to discuss with an interviewer."], html: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:0;padding:32px;background:#f6f7fb;color:#171e31}main{max-width:760px;margin:auto;background:white;border-radius:24px;padding:32px;box-shadow:0 12px 40px #0001}h1{margin-top:0}p{line-height:1.6}</style></head><body><main><h1>Prototype preview</h1><p>A focused concept around the stated business problem.</p></main></body></html>' });
  }
});
app.use(express.static(root));
app.get("*", (req, res) => {
  const index = fs.existsSync(path.join(root, "index.html")) ? "index.html" : "index.src.html";
  res.sendFile(path.join(root, index));
});
app.listen(PORT, () => console.log(`GetJobReady listening on ${PORT}`));
