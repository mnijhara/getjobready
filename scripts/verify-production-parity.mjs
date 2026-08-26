import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const expect = (condition, message) => { if (!condition) fail(message); console.log(`PASS: ${message}`); };

const entry = read('index.src.html');
const app = read('src/main-v2.jsx');
const cvFlow = read('src/cv-improvement-flow.js');
const audioAuto = read('src/audio-auto.js');
const distHtml = read('dist/index.html');
const distBundle = fs.readdirSync('dist/assets').filter((name) => name.endsWith('.js')).map((name) => read(`dist/assets/${name}`)).join('\n');

expect(entry.includes('/src/cv-improvement-flow.js'), 'source entry loads the CV improvement flow');
expect(entry.includes('/src/audio-auto.js'), 'source entry loads the hands-free audio bridge');
expect(cvFlow.includes('/api/improve-cv'), 'CV improvement flow owns the improvement API bridge');
expect(cvFlow.includes("url==='/api/interview-turn'||url==='/api/interview-feedback'"), 'saved CV flow intercepts interview and feedback requests');
expect(/body\.cv=improved/.test(cvFlow), 'saved improved CV replaces the original interview CV text');
expect(/body\.cvData\s*=\s*['"]{2}/.test(cvFlow) && /body\.cvMime\s*=\s*['"]{2}/.test(cvFlow), 'original uploaded CV bytes are not sent after the improved CV is saved');
expect(cvFlow.includes("sessionStorage.setItem('gjr_cv_ready','1')"), 'final CV save creates an interview-ready state');
expect(cvFlow.includes("sessionStorage.removeItem('gjr_cv_ready')"), 'editing the final CV invalidates the saved state');
expect(cvFlow.includes('Make your CV stronger first.'), 'CV improvement studio is present');
expect(cvFlow.includes('Continue to live audio interview'), 'interview remains gated behind saved CV edits');
expect(audioAuto.includes('Hands-free interview:'), 'hands-free audio guidance is present');
expect(audioAuto.includes("s.querySelector('.transcript p')"), 'hands-free bridge reads the React live transcript');
expect(audioAuto.includes('silenceTimer=setTimeout(()=>finishAnswer(s),1800)'), 'hands-free bridge ends answers after a short silence');
expect(audioAuto.includes("answer with your voice|speak answer|speak now/i"), 'hands-free bridge automatically starts each answer');
expect(audioAuto.includes("done speaking|stop|end answer/i"), 'hands-free bridge automatically ends each answer');
expect(app.includes('AI Audio Interview'), 'React interview screen is present');
expect(app.includes('SpeechRecognition'), 'browser speech recognition is present');

// Minifiers are free to rewrite property assignments, so production parity must assert
// stable feature markers rather than source-code spelling such as `body.cv=improved`.
expect(distHtml.includes('cv-improvement-flow') || distBundle.includes('Make your CV stronger first.'), 'production bundle contains the CV improvement flow');
expect(distHtml.includes('audio-auto') || distBundle.includes('Hands-free interview:'), 'production bundle contains the hands-free audio bridge');
expect(distBundle.includes('.transcript p') || distBundle.includes('silenceTimer'), 'production bundle contains automatic transcript/silence behavior');
expect(distBundle.includes('Continue to live audio interview'), 'production bundle contains the CV-to-interview gate');
expect(distBundle.includes('gjr_cv_improved') && distBundle.includes('gjr_cv_ready'), 'production bundle contains saved improved-CV interview state');
expect(distBundle.includes('YOUR CAREER FEED'), 'production bundle contains the current student career feed');
expect(distBundle.includes('feed-nav'), 'production bundle contains persistent student navigation');
expect(distBundle.includes('Impress the Interviewer'), 'production bundle contains the shipped demo module');

console.log('GetJobReady production/source parity verification passed.');
