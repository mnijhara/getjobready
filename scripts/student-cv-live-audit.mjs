import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.GJR_BASE_URL || 'https://getjobready.online/';
const DIR = process.env.GJR_AUDIT_FILES || '/tmp/gjr-audit';
const CV = fs.readFileSync(`${DIR}/vijit-student-cv.txt`, 'utf8');
const UNSUPPORTED = [/\bconsulting\b/i,/\bdealer\b/i,/\bClaude\b/i,/\bCopilot\b/i,/\bChatGPT\b/i,/\b42%\b/i,/\b30%\b/i,/\b50,?000\+?\s*(test runs|users)\b/i];
const SUPPORTED = [/Coding Panda/i,/Sync Engine/i,/TravelGen AI/i,/Edusphere/i,/Cloudflare R2/i,/Judge ?0/i,/IIIT Ranchi/i,/CRDT/i,/Go/i,/React/i];
const results=[];const failures=[];
const pass=m=>{results.push({kind:'pass',msg:m});console.log('[PASS]',m)};
const info=m=>{results.push({kind:'info',msg:m});console.log('[INFO]',m)};
const fail=m=>{failures.push(m);console.error('[FAIL]',m)};
async function waitForUI(page){await page.waitForTimeout(600)}
async function click(page,re,label){const el=page.getByText(re).first();if(!await el.count()||!await el.isVisible().catch(()=>false))throw new Error(`${label}: control not visible`);await el.scrollIntoViewIfNeeded();await el.click({timeout:15000});await waitForUI(page);pass(`${label} clicked`)}

async function runStudentInterview(name,device){
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...device,permissions:['microphone']});
 const apiResponses=[],consoleErrors=[],pageErrors=[],failedRequests=[];
 try{
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('requestfailed',r=>failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'failed'}`));
  page.on('response',async r=>{if(!r.url().includes('/api/interview-turn'))return;try{apiResponses.push({status:r.status(),body:await r.json()})}catch{apiResponses.push({status:r.status(),body:await r.text()})}});
  await page.addInitScript(({cv})=>{
   localStorage.setItem('gjr_cv_context',cv);localStorage.setItem('gjr_cv_mode','general');localStorage.setItem('gjr_cv_file_context',cv);
   class FakeRecognition{start(){this.onstart?.();setTimeout(()=>this.onresult?.({resultIndex:0,results:[{0:{transcript:'At Coding Panda I worked on the compiler platform and built execution APIs.',confidence:0.99},isFinal:true}]}),250)}stop(){this.onend?.()}}
   window.SpeechRecognition=FakeRecognition;window.webkitSpeechRecognition=FakeRecognition;
   window.speechSynthesis={cancel(){},speak(u){setTimeout(()=>u.onend?.(),100)},getVoices(){return[{name:'Google English India',lang:'en-IN'}]}};
  },{cv:CV});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});await waitForUI(page);pass(`${name}: production site loaded`);
  await click(page,/AI Audio Interview|Talk to your AI interviewer/i,`${name}: AI interview`);
  // The production entry opens an interview choice modal first. Select the real voice interview path.
  const realVoice=page.getByText(/Have a real voice interview/i).first();
  if(await realVoice.count()&&await realVoice.isVisible().catch(()=>false)){await realVoice.click({timeout:15000});await waitForUI(page);pass(`${name}: real voice interview option selected`)}
  const body1=await page.locator('body').innerText();
  if(!/AI Mock Interview|LIVE INTERVIEW|real conversation|AI Audio Interview/i.test(body1)){
   info(`${name}: post-selection body: ${body1.slice(0,1800).replace(/\n/g,' | ')}`);
   throw new Error(`${name}: interview screen not reached`);
  }
  pass(`${name}: interview screen reached with CV context seeded`);
  const start=page.getByRole('button',{name:/start.*conversation|start interview|start/i}).first();
  if(!await start.count()||!await start.isVisible().catch(()=>false))throw new Error(`${name}: start interview control missing`);
  await start.click({timeout:15000});await page.waitForTimeout(8000);
  const body=await page.locator('body').innerText();
  const questionLines=body.split(/\n+/).map(s=>s.trim()).filter(s=>s.endsWith('?')&&s.length>20);
  const apiQuestions=[];
  const walk=(v,key='')=>{if(v==null)return;if(typeof v==='string'){if(/question|prompt|text/i.test(key)&&v.includes('?'))apiQuestions.push(v);return}if(Array.isArray(v)){for(const x of v)walk(x,key)}else if(typeof v==='object'){for(const [k,x] of Object.entries(v))walk(x,k)}};
  for(const r of apiResponses)walk(r.body);
  const questions=[...new Set([...apiQuestions,...questionLines])];
  if(!questions.length)throw new Error(`${name}: no interview question appeared after starting the interview; API responses=${apiResponses.length}`);
  pass(`${name}: generated ${questions.length} visible/API question(s)`);info(`${name}: questions observed: ${questions.slice(0,8).join(' | ')}`);
  for(const q of questions)for(const bad of UNSUPPORTED)if(bad.test(q))fail(`${name}: unsupported CV claim in generated question: ${q}`);
  if(!questions.some(q=>SUPPORTED.some(re=>re.test(q))))fail(`${name}: no generated question referenced any concrete CV-supported experience/project/technology`);else pass(`${name}: at least one generated question is concretely grounded in the student's CV`);
  if(apiResponses.some(r=>r.status>=400))fail(`${name}: interview-turn returned HTTP error ${apiResponses.map(r=>r.status).join(',')}`);else if(apiResponses.length)pass(`${name}: interview-turn API returned successful response(s)`);else info(`${name}: no interview-turn response captured; question was produced client-side`);
  if(consoleErrors.length)info(`${name}: console errors: ${consoleErrors.slice(0,5).join(' | ')}`);
  if(pageErrors.length)fail(`${name}: page errors: ${pageErrors.join(' | ')}`);
  if(failedRequests.length)info(`${name}: failed requests: ${failedRequests.slice(0,5).join(' | ')}`);
 }catch(e){fail(`${name}: ${e.message}`)}finally{await context.close();await browser.close()}
}
await runStudentInterview('desktop',{viewport:{width:1440,height:900}});
await runStudentInterview('mobile',{...devices['Pixel 7']});
const report={base:BASE,generatedAt:new Date().toISOString(),studentFixture:'Vijit Vishnoi (sanitized CV facts; contact details omitted)',passed:failures.length===0,results,failures};
fs.writeFileSync('student-cv-live-audit-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
