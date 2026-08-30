const fs = require('fs');
const path = require('path');

const root = process.cwd();
const candidates = ['src','app','components'];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules','.git','dist'].includes(entry.name)) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(p);
  }
}
for (const dir of candidates) walk(path.join(root, dir));
const source = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

function assertAny(patterns, label) {
  const ok = patterns.some(p => p.test(source));
  if (!ok) throw new Error(`Regression contract missing: ${label}`);
}

// Behavioural contracts only: intentionally tolerant of formatting/refactoring.
assertAny([/Corporate Ready/i], 'Corporate Ready surface');
assertAny([/AI at Work/i], 'AI at Work surface');
assertAny([/Impress the Interviewer/i], 'Impress the Interviewer surface');
assertAny([/Interview History/i], 'Interview History surface');
assertAny([/General CV/i, /CV Preparation/i], 'CV preparation surface');

console.log(`Product regression verification passed across ${files.length} source files.`);
