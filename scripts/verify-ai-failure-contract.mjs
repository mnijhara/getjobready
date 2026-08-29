import fs from 'node:fs';

const server = fs.readFileSync('server.cjs', 'utf8');

const contracts = [
  {
    route: "app.post('/api/interview-turn'",
    nextRoute: "app.post('/api/coach'",
    name: 'interview-turn',
    required: "res.status(503).json({ error: 'The AI interviewer is temporarily unavailable. Your answer was not scored. Please retry this turn.' })",
    forbidden: ['fallbackQuestions', 'score: 70', 'Your answer was scored'],
  },
  {
    route: "app.post('/api/coach'",
    nextRoute: "app.post('/api/demo'",
    name: 'coach',
    required: "res.status(503).json({ error: 'AI coaching is temporarily unavailable. Please retry in a moment.' })",
    forbidden: ['Start small: choose one recurring task', '15-minute weekly review', 'What did I learn this week that makes next week easier?'],
  },
  {
    route: "app.post('/api/demo'",
    nextRoute: "app.get(/^\\/pdf\\.worker",
    name: 'demo',
    required: "res.status(503).json({ error: 'AI prototype generation is temporarily unavailable. Please retry in a moment.' })",
    forbidden: ['A candidate-built prototype around a real business problem.', 'Clear problem-to-solution narrative', '<h1>Prototype preview</h1>'],
  },
];

for (const contract of contracts) {
  const start = server.indexOf(contract.route);
  const end = server.indexOf(contract.nextRoute, start);
  if (start < 0 || end < 0) throw new Error(`AI failure contract: ${contract.name} route not found`);
  const route = server.slice(start, end);
  if (!route.includes(contract.required)) throw new Error(`AI failure contract: ${contract.name} must return an explicit 503 response when AI fails`);
  for (const marker of contract.forbidden) {
    if (route.includes(marker)) throw new Error(`AI failure contract: ${contract.name} must never return synthetic AI output after provider failure (${marker})`);
  }
  for (const marker of ['res.status(503)', 'catch (error)']) {
    if (!route.includes(marker)) throw new Error(`AI failure contract: ${contract.name} missing ${marker}`);
  }
}

console.log('AI failure contracts verified: AI-dependent routes never present synthetic success after provider failure.');
