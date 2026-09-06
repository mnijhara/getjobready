import assert from 'node:assert';

// Mock localStorage
const storage = new Map();
global.window = global;
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};
global.sessionStorage = {
  getItem: (k) => null,
  setItem: (k, v) => {},
  removeItem: (k) => {},
  clear: () => {}
};
global.CustomEvent = class CustomEvent { constructor(name) { this.name = name; } };
global.window.dispatchEvent = () => true;

const { db, getProfileEmail, getEmailKey } = await import('../src/db.js');

console.log('=== TEST: Multi-User Isolation & Zero Data Leakage ===');

// 1. User A logs in
console.log('1. User A (mnijhara@gmail.com) logs in');
db.saveProfile('mnijhara@gmail.com');
assert.strictEqual(getProfileEmail(), 'mnijhara@gmail.com');
assert.strictEqual(getEmailKey(), 'mnijhara_gmail_com');

db.saveMasterCV('CV content for User A');
db.saveApplication({ id: 'app-a', company: 'Google', cv: 'CV A', jd: 'JD A', updated: '2026-09-05T10:00:00Z' });
db.saveInterview({ id: 'iv-a', role: 'SWE', score: 85, date: '2026-09-05T11:00:00Z' });

assert.strictEqual(db.getMasterCV(), 'CV content for User A');
assert.strictEqual(db.getApplications().length, 1);
assert.strictEqual(db.getInterviews().length, 1);
console.log('  [PASS] User A created Master CV, Application, and Interview');

// 2. User A logs out
console.log('2. User A logs out');
db.logout();
assert.strictEqual(db.getProfile(), null);

// 3. User B logs in on the SAME device
console.log('3. User B (mnijhara21@gmail.com) logs in on same device');
db.saveProfile('mnijhara21@gmail.com');
assert.strictEqual(getProfileEmail(), 'mnijhara21@gmail.com');
assert.strictEqual(getEmailKey(), 'mnijhara21_gmail_com');

// Assert User B has ZERO data from User A
assert.strictEqual(db.getMasterCV(), '', 'User B must NOT see User A Master CV');
assert.strictEqual(db.getApplications().length, 0, 'User B must NOT see User A Applications');
assert.strictEqual(db.getInterviews().length, 0, 'User B must NOT see User A Interviews');
console.log('  [PASS] User B has clean slate (0 applications, 0 interviews, empty CV)');

// 4. User B adds their own application
console.log('4. User B creates their own application');
db.saveApplication({ id: 'app-b', company: 'Microsoft', cv: 'CV B', jd: 'JD B', updated: '2026-09-06T12:00:00Z' });
assert.strictEqual(db.getApplications().length, 1);
assert.strictEqual(db.getApplications()[0].company, 'Microsoft');
assert.strictEqual(db.getInterviews().length, 0);
console.log('  [PASS] User B application isolated');

// 5. User B logs out, User A logs back in
console.log('5. User B logs out, User A logs back in');
db.logout();
db.saveProfile('mnijhara@gmail.com');
assert.strictEqual(db.getMasterCV(), 'CV content for User A');
assert.strictEqual(db.getApplications().length, 1);
assert.strictEqual(db.getApplications()[0].company, 'Google');
assert.strictEqual(db.getInterviews().length, 1);
console.log('  [PASS] User A data preserved and isolated from User B');

// 6. Dirty Device Simulation: simulate legacy keys present from old versions
console.log('6. Dirty device test: legacy unscoped keys pre-populated');
storage.set('gjr_master_cv', 'LEAKED MASTER CV FROM OLD VERSION');
storage.set('gjr_apps', JSON.stringify([{ id: 'leaked-app', company: 'BadCorp', updated: '2026-09-05T00:00:00Z' }]));
storage.set('gjr_interviews', JSON.stringify([{ id: 'leaked-iv', role: 'BadRole', score: 10, date: '2026-09-05T00:00:00Z' }]));

// User C logs in on this dirty device
db.saveProfile('student_c@gmail.com');
assert.strictEqual(db.getMasterCV(), '', 'User C must NOT see leaked master CV');
assert.strictEqual(db.getApplications().length, 0, 'User C must NOT see leaked apps');
assert.strictEqual(db.getInterviews().length, 0, 'User C must NOT see leaked interviews');
console.log('  [PASS] Dirty device legacy keys completely quarantined and ignored');

console.log('\nAll Multi-User Isolation Tests Passed 100%!\n');
process.exit(0);
