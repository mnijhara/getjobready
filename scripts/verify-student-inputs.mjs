import fs from 'node:fs';

const app = fs.readFileSync('src/main-v2.jsx', 'utf8');
const fail = message => { console.error(`FAIL: ${message}`); process.exit(1); };
const expect = (condition, message) => {
  if (!condition) fail(message);
  console.log(`PASS: ${message}`);
};

expect(app.includes("/\\.(pdf|txt|docx)$/i.test(file.name)"), 'CV uploader accepts PDF, TXT and DOCX');
expect(app.includes("PDF, DOCX or TXT · or paste below"), 'CV uploader copy matches supported file types');
expect(app.includes("async function docxText(file)"), 'DOCX text extraction is implemented');
expect(app.includes("import('mammoth')"), 'DOCX extraction uses the bundled Mammoth dependency');
expect(app.includes("if(/\\.docx$/i.test(file.name))return docxText(file)"), 'DOCX uploads are routed through text extraction');
expect(app.includes("readSession('gjr_career','job')"), 'career choice restores through the shared session helper');
expect(app.includes("saveSession('gjr_cv_text',text)"), 'uploaded CV text is persisted');
expect(app.includes("saveSession('gjr_jd_text',prep==='general'?'':jd)"), 'target JD text is persisted after analysis');
expect(app.includes("saveSession('gjr_cv_improved',text)"), 'saved improved CV is persisted');
expect(app.includes("saveSession('gjr_cv_ready','1')"), 'CV save gate is persisted');
expect(!app.includes("accept=\".pdf,.txt,.doc,.docx\""), 'native CV input does not advertise unsupported legacy DOC files');
console.log('GetJobReady student input regression verification passed.');
