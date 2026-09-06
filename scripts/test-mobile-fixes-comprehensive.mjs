import fs from 'node:fs';

const source = fs.readFileSync('src/main-v2.jsx', 'utf8');

// 1. Extract cleanExtractedCVText
const cleanCvStart = source.indexOf('function cleanExtractedCVText(');
const cleanCvEnd = source.indexOf('function detectDomain(', cleanCvStart);
const cleanCvCode = source.slice(cleanCvStart, cleanCvEnd);

// 2. Extract detectDomain
const ddStart = source.indexOf('function detectDomain(');
const ddEnd = source.indexOf('function truncateAtWord(', ddStart);
const ddCode = source.slice(ddStart, ddEnd);

// 3. Extract truncateAtWord
const twStart = source.indexOf('function truncateAtWord(');
const twEnd = source.indexOf('let cachedVoices', twStart);
const twCode = source.slice(twStart, twEnd);

// 4. Extract cleanBullet
const tbStart = source.indexOf('function cleanBullet(');
const ntsStart = source.indexOf('function normalizeTechSpeech(', tbStart);
const cbCode = source.slice(tbStart, ntsStart);

// 4b. Extract normalizeTechSpeech
const crpStart = source.indexOf('function cleanRepeatedPhrases(', ntsStart);
const ntsCode = source.slice(ntsStart, crpStart);

// 5. Extract cleanRepeatedPhrases
const csrStart = source.indexOf('function combineSpeechResults(', crpStart);
const crpCode = source.slice(crpStart, csrStart);

// 6. Extract combineSpeechResults
const gtqStart = source.indexOf('function generateTailoredCVQuestions(', csrStart);
const csrCode = source.slice(csrStart, gtqStart);

// 7. Extract generateTailoredCVQuestions & getSafeInterviewQuestions
const evalStart = source.indexOf('function evaluateInterviewTurnLocal(', gtqStart);
const gtqCode = source.slice(gtqStart, evalStart);

// 8. Extract evaluateInterviewTurnLocal
const evalEnd = source.indexOf('function localReview(', evalStart);
const evalCode = source.slice(evalStart, evalEnd);

const harness = `
${cleanCvCode}
${ddCode}
${twCode}
${cbCode}
${ntsCode}
${crpCode}
${csrCode}
${gtqCode}
${evalCode}

return {
  normalizeTechSpeech,
  cleanRepeatedPhrases,
  combineSpeechResults,
  detectDomain,
  generateTailoredCVQuestions,
  getSafeInterviewQuestions,
  evaluateInterviewTurnLocal
};
`;

const fn = new Function(harness)();
const {
  normalizeTechSpeech,
  cleanRepeatedPhrases,
  combineSpeechResults,
  detectDomain,
  generateTailoredCVQuestions,
  getSafeInterviewQuestions,
  evaluateInterviewTurnLocal
} = fn;

const passes = [];
const failures = [];
const pass = (m) => { passes.push(m); console.log('  [PASS]', m); };
const fail = (m) => { failures.push(m); console.error('  [FAIL]', m); };

console.log('\n=== TEST SUITE 1: Mobile Speech Deduplication & Tech Phonetic Normalization ===');
// Test 1: Android Chrome cumulative prefix expansion
const mobileResults1 = [
  { transcript: 'I', isFinal: true },
  { transcript: 'I did', isFinal: true },
  { transcript: 'I did a', isFinal: true },
  { transcript: 'I did a good job', isFinal: true }
];
const text1 = combineSpeechResults(mobileResults1);
if (text1 === 'I did a good job') pass('Cumulative mobile results merged to "I did a good job"');
else fail(`Expected "I did a good job", got "${text1}"`);

// Test 2: 5-step incremental expansion
const mobileResults2 = [
  { transcript: 'I', isFinal: true },
  { transcript: 'I did', isFinal: true },
  { transcript: 'I did a', isFinal: true },
  { transcript: 'I did a good', isFinal: true },
  { transcript: 'I did a good job', isFinal: true }
];
const text2 = combineSpeechResults(mobileResults2);
if (text2 === 'I did a good job') pass('5-step cumulative mobile results merged to "I did a good job"');
else fail(`Expected "I did a good job", got "${text2}"`);

// Test 3: Raw stutter string deduplication
const rawStutter = 'I I did I did a I did a good job';
const cleanedStutter = cleanRepeatedPhrases(rawStutter);
if (cleanedStutter === 'I did a good job') pass(`cleanRepeatedPhrases("${rawStutter}") -> "${cleanedStutter}"`);
else fail(`Expected "I did a good job", got "${cleanedStutter}"`);

const rawStutter5 = 'I I did I did a I did a good I did a good job';
const cleanedStutter5 = cleanRepeatedPhrases(rawStutter5);
if (cleanedStutter5 === 'I did a good job') pass(`cleanRepeatedPhrases("${rawStutter5}") -> "${cleanedStutter5}"`);
else fail(`Expected "I did a good job", got "${cleanedStutter5}"`);

// Test 4: Mobile Indian English Speech Misrecognitions (Reported by student)
const q4Raw = 'AI Delhi are you charged GPT I use all kind of clothes';
const q4Normalized = normalizeTechSpeech(q4Raw);
if (q4Normalized.includes('AI daily') && q4Normalized.includes('ChatGPT') && q4Normalized.includes('Claude')) {
  pass(`normalizeTechSpeech("${q4Raw}") -> "${q4Normalized}"`);
} else {
  fail(`Expected AI daily + ChatGPT + Claude, got "${q4Normalized}"`);
}

const q5Raw = 'I use claught to resolve all the problems that I have';
const q5Normalized = normalizeTechSpeech(q5Raw);
if (q5Normalized === 'I used Claude to resolve all the problems that I have') {
  pass(`normalizeTechSpeech("${q5Raw}") -> "${q5Normalized}"`);
} else {
  fail(`Expected "I used Claude to resolve all the problems that I have", got "${q5Normalized}"`);
}

const q6Raw = 'I will like to learn coding mode';
const q6Normalized = normalizeTechSpeech(q6Raw);
if (q6Normalized === 'I would like to learn coding more') {
  pass(`normalizeTechSpeech("${q6Raw}") -> "${q6Normalized}"`);
} else {
  fail(`Expected "I would like to learn coding more", got "${q6Normalized}"`);
}

// Test 5: Filler word detection does not flag "tools like Claude" or "would like to"
const evalFillers1 = evaluateInterviewTurnLocal('Q', 'I used AI daily used ChatGPT and I used all kinds of tools like Claude', []);
if (evalFillers1.evaluation?.fillers === 0) {
  pass('Preposition "tools like Claude" is NOT falsely flagged as a verbal crutch');
} else {
  fail(`Expected 0 fillers, got ${evalFillers1.evaluation?.fillers}`);
}

const evalFillers2 = evaluateInterviewTurnLocal('Q', 'I would like to learn coding more', []);
if (evalFillers2.evaluation?.fillers === 0) {
  pass('Verb phrase "would like to learn" is NOT falsely flagged as a verbal crutch');
} else {
  fail(`Expected 0 fillers, got ${evalFillers2.evaluation?.fillers}`);
}

console.log('\n=== TEST SUITE 2: Domain Detection for Software Engineers ===');
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

const domainVijit = detectDomain(VIJIT_CV, '', 'Backend Engineer');
if (domainVijit === 'Technology') pass('Vijit CV detected as Technology (NOT Consulting)');
else fail(`Expected Technology, got ${domainVijit}`);

const domainWithOps = detectDomain(VIJIT_CV + '\nOperating systems and CRUD operations test strategy', '', '');
if (domainWithOps === 'Technology') pass('Operating systems and test strategy do not trigger Consulting for engineers');
else fail(`Expected Technology, got ${domainWithOps}`);

console.log('\n=== TEST SUITE 3: Question Grounding & Stale Question Sanitization ===');
const generatedQs = generateTailoredCVQuestions(VIJIT_CV, '', 'Backend Engineer');
const allQText = generatedQs.join(' ');

if (!/consulting/i.test(allQText)) pass('Generated questions do NOT mention Consulting');
else fail('Generated questions contain Consulting');

if (!/dealer/i.test(allQText)) pass('Generated questions do NOT mention dealer');
else fail('Generated questions contain dealer');

if (!/at Vijit Vishnoi|at Vijit/i.test(allQText)) pass('Generated questions do NOT use candidate name as company');
else fail('Generated questions use candidate name as company');

if (generatedQs[3].includes('How have you used AI in your job, internship, or SIP')) pass('Q4 contains mandatory SIP AI question');
else fail(`Q4 expected mandatory AI question, got: "${generatedQs[3]}"`);

// Test sanitizer on the user's reported corrupted questions from mobile
const oldMobileCorruptedQuestions = [
  'Tell me about yourself — your background in Consulting, your academic journey, and the one experience or project you\'re most proud of so far.',
  'In your CV, you mention "Streamlined test case batch storage with Cloudflare R2" — walk me through...',
  'Tell me about a major project at Vijit Vishnoi Backend Engineer. What was your personal ownership, what challenge did you face, and what was the quantifiable outcome?',
  'How are you using AI tools — like ChatGPT, Claude, Copilot, or analytics frameworks in your work or studies? Give me a specific example where it made you faster or more effective.',
  'Describe a time when you faced conflict with a team member, dealer, or stakeholder, or when a project hit an unexpected bottleneck. How did you handle it and what was the resolution?',
  'If you joined the Backend Engineer team tomorrow, what\'s your 30-day plan to add real value, build relationships, and prove yourself quickly?'
];

const cleanedQuestions = getSafeInterviewQuestions(oldMobileCorruptedQuestions, VIJIT_CV, '', 'Backend Engineer');
if (cleanedQuestions !== oldMobileCorruptedQuestions) pass('Stale corrupted questions from mobile Supabase session were detected and replaced');
else fail('Stale corrupted questions were NOT replaced');

const cleanedText = cleanedQuestions.join(' ');
if (!/consulting/i.test(cleanedText)) pass('Sanitized questions do NOT mention Consulting');
else fail('Sanitized questions still contain Consulting');

if (!/at Vijit Vishnoi Backend Engineer/i.test(cleanedText)) pass('Sanitized questions do NOT use candidate name as company');
else fail('Sanitized questions still contain "at Vijit Vishnoi Backend Engineer"');

if (!/dealer/i.test(cleanedText)) pass('Sanitized questions do NOT mention dealer');
else fail('Sanitized questions still contain dealer');

console.log('\n=== TEST SUITE 4: Zero Score and Evaluation Formatting ===');
const evalGibberish = evaluateInterviewTurnLocal('Tell me about yourself', 'i did a good job', []);
if (evalGibberish.evaluation.score === 0) pass('Gibberish placeholder "i did a good job" scored 0/100');
else fail(`Expected score 0, got ${evalGibberish.evaluation.score}`);

if (evalGibberish.evaluation.notes.startsWith('0/100')) pass('Notes start with 0/100 for score 0');
else fail(`Expected notes to start with 0/100, got: "${evalGibberish.evaluation.notes}"`);

// Verify final feedback strengths on low score
const lowEval = evaluateInterviewTurnLocal('Tell me about a challenge', 'bad answer', [
  { question: 'Q1', answer: 'short', evaluation: { score: 0 } },
  { question: 'Q2', answer: 'short', evaluation: { score: 0 } },
  { question: 'Q3', answer: 'short', evaluation: { score: 0 } },
  { question: 'Q4', answer: 'short', evaluation: { score: 0 } },
  { question: 'Q5', answer: 'short', evaluation: { score: 0 } }
]);

if (lowEval.finalFeedback && lowEval.finalFeedback.strengths.length > 0) {
  pass('Low score finalFeedback has non-empty strengths guidance: "' + lowEval.finalFeedback.strengths[0] + '"');
} else {
  fail('Low score finalFeedback has empty strengths array');
}

console.log('\n=== TEST SUITE 5: Score N/A Format Check in UI Code ===');
const hasFalsyScoreBug = /Score:\s*\$\{[^}]*score\s*\|\|\s*['"]N\/A['"]\}/.test(source);
if (!hasFalsyScoreBug) pass('Source does NOT have `score || "N/A"` bug (zero scores render as 0/100)');
else fail('Source STILL has `score || "N/A"` bug');

console.log(`\nResults: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length > 0) process.exit(1);
