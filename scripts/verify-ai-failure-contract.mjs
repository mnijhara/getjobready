import fs from 'node:fs';

const server = fs.readFileSync('server.cjs', 'utf8');
const start = server.indexOf("app.post('/api/interview-turn'");
const end = server.indexOf("app.post('/api/coach'", start);
if (start < 0 || end < 0) throw new Error('AI failure contract: interview-turn route not found');
const route = server.slice(start, end);

if (!route.includes("res.status(503).json({ error: 'The AI interviewer is temporarily unavailable. Your answer was not scored. Please retry this turn.' })")) {
  throw new Error('AI failure contract: interview-turn must return a safe 503 response when the AI fails');
}
if (route.includes('fallbackQuestions') || route.includes("score: 70")) {
  throw new Error('AI failure contract: interview-turn must never fabricate a scored result after an AI failure');
}

for (const marker of ["res.status(503)", "Your answer was not scored", 'catch (error)']) {
  if (!route.includes(marker)) throw new Error(`AI failure contract: missing ${marker}`);
}

console.log('AI failure contract verified: interview errors are explicit and never scored as synthetic success.');
