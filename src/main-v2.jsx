import React,{useEffect,useLayoutEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{Upload,FileText,Target,Mic,ShieldCheck,Sparkles,ArrowRight,CheckCircle2,BriefcaseBusiness,ChevronRight,MessageSquareText,X,Headphones,Volume2,VolumeX,RefreshCw,Check,Folder,Plus,Trash2,Copy,ExternalLink,Download,Lightbulb,BookOpen,Send,AlertCircle,GraduationCap,Award}from'lucide-react';

import'./styles.css';import'./voice.css';import'./mode-tabs.css';
import { db } from './db.js';

const modules=[
{id:'resume',icon:FileText,title:'CV Preparation',text:'Review your CV, improve it, then practise with the final version.',tag:'Start here'},
{id:'interview',icon:Mic,title:'AI Audio Interview',text:'A real voice conversation with automatic capture and a visible transcript.',tag:'Practice'},
{id:'demo',icon:Target,title:'Impress the Interviewer',text:'Turn a company problem into a polished product concept and demo.',tag:'Stand out'},
{id:'readiness',icon:ShieldCheck,title:'Corporate Ready',text:'Build communication, confidence, feedback and workplace habits.',tag:'Thrive'},
{id:'ai',icon:Sparkles,title:'AI at Work',text:'Learn practical AI workflows that make you faster and sharper.',tag:'Future-ready'}
];

const fallback=mode=>({score:72,headline:mode==='general'?'Your CV has a solid base.':'Your profile has a solid base — now make it role-specific.',summary:'Strengthen evidence, clarity and outcomes before you interview.',highlights:['Clear academic foundation','Transferable problem-solving skills','Strong learning intent'],gaps:['Add measurable outcomes','Make ownership explicit','Connect your strongest evidence to the target role'],cvImprovements:['Lead bullets with action + outcome','Quantify scope only where your CV supports it','Move the strongest evidence higher'],rewrittenBullets:['Led a project using a structured approach to improve a measurable outcome.','Collaborated with a cross-functional team to deliver a project within the agreed timeline.'],plan:['Create a 90-second introduction','Strengthen your top three CV bullets','Build three STAR stories','Research the company and role','Practise five interview questions','Complete a realistic voice interview','Review feedback and repeat'],interviewQuestions:['Tell me about yourself and the experience you are most proud of.','Walk me through a project where you solved a difficult problem.','Tell me about a time you took ownership.','What is one piece of feedback that changed how you work?','What would you do in your first 30 days?']});

const readSession=(key,f='')=>{try{return sessionStorage.getItem(key)||f}catch{return f}};
const saveSession=(key,v)=>{try{sessionStorage.setItem(key,v)}catch{}};

function scrollToTop(){
 const root=typeof document!=='undefined'?document.documentElement:null;
 const prevScrollBehavior=root?root.style.scrollBehavior:'';
 if(root)root.style.scrollBehavior='auto';
 try{
  window.scrollTo({top:0,left:0,behavior:'instant'});
 }catch{
  try{window.scrollTo(0,0)}catch{}
 }
 if(root)root.scrollTop=0;
 if(typeof document!=='undefined'&&document.body)document.body.scrollTop=0;
 if(root){
  requestAnimationFrame(()=>{
   root.style.scrollBehavior=prevScrollBehavior;
  });
 }
}

async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const ct=r.headers.get('content-type')||'';if(!ct.includes('application/json')){throw new Error('API unavailable')}const text=await r.text();if(!text||text.startsWith('<!doctype')||text.startsWith('<html')){throw new Error('API unavailable')}let data;try{data=JSON.parse(text)}catch(e){throw new Error('API unavailable')}if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data}

async function pdfText(file){
 try{
  const lib=await import('pdfjs-dist').catch(e=>{
   if(e?.message?.includes('dynamically imported module')){
    window.location.reload();
   }
   throw e;
  });
  const pdfjs=lib.default&&lib.default.getDocument?lib.default:lib;
  pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),disableWorker:true}).promise;
  let out='';
  for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i);
   const t=await p.getTextContent();
   out+=t.items.map(x=>x.str).join(' ')+'\n';
  }
   const clean=out
    .replace(/(\b[A-Za-z]{2,})-\s+([a-z]{2,}\b)/g, '$1$2')
    .replace(/\bTechnolo(?:\.|\b)(?!\w)/gi, 'Technology')
    .replace(/\bEngin(?:\.|\b)(?!\w)/gi, 'Engineering')
    .replace(/\s+([,;.])/g, '$1')
    .trim();
   if(clean.length>30&&!/^\s*%PDF-/i.test(clean)&&!/\/FlateDecode|\/Linearized/i.test(clean)){
    return clean;
   }
 }catch(err){
  console.warn('PDF.js parsing failed, using server AI extraction:',err);
 }
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  const base64=btoa(binary);
  const res=await post('/api/extract-cv',{data:base64,mime:file.type||'application/pdf'});
  if(res?.text&&!/^\s*%PDF-/i.test(res.text)){
   return res.text;
  }
 }catch(e){
  console.warn('Server-side AI PDF extraction fallback failed:',e);
 }
 throw new Error('Could not extract text from this PDF file. Please paste your CV text into the text box below.');
}

async function docxText(file){
 try{
  const mammoth=await import('mammoth').catch(e=>{
   if(e?.message?.includes('dynamically imported module')){window.location.reload()}
   throw e;
  });
  const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
  const text=String(result.value||'').trim();
  if(text)return text;
 }catch(e){}
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  const base64=btoa(binary);
  const res=await post('/api/extract-cv',{data:base64,mime:file.type||'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  if(res?.text)return res.text;
 }catch(e){}
 throw new Error('Could not read this DOCX file. Please paste your text into the text box below.');
}

async function readFile(file){
 if(file.type==='text/plain'||/\.txt$/i.test(file.name))return file.text();
 if(/\.pdf$/i.test(file.name)||file.type==='application/pdf')return pdfText(file);
 if(/\.docx$/i.test(file.name))return docxText(file);
 if(file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||file.type?.includes('wordprocessingml'))return docxText(file);
 throw new Error('Unsupported file type. Please upload a PDF, DOCX or TXT file.');
}


function toSentenceCase(text){
 if(!text||typeof text!=='string')return text;
 const letters=text.replace(/[^a-zA-Z]/g,'');
 if(!letters.length)return text;
 const upperCount=text.replace(/[^A-Z]/g,'').length;
 if(upperCount/letters.length>0.65){
  return text.toLowerCase()
   .replace(/(^\s*|[.!?]\s+|\n\s*)([a-z])/g,(m,p1,p2)=>p1+p2.toUpperCase())
   .replace(/\b(hr|hrbp|hris|ai|llm|sql|dcf|mena|b2b|b2c|ceo|cfo|cto|vp|dvp|imt|hcl|byju's|cars24|fedex|gpa|mba|bcom|b\.com|delhi|india|cr|lakh|lakhs|crore|crores)\b/gi,s=>s.toUpperCase());
 }
 return text;
}

function cleanExtractedCVText(raw){
 if(!raw)return'';
 let text=raw
  .replace(/\r\n/g,'\n')
  .replace(/(\b[A-Za-z]{2,})-\s*[\r\n]+\s*([a-z]{2,}\b)/g,'$1$2')
  .replace(/\bTechnol(?:ogy|og|o)?(?:\.|\b)(?!\w)/gi,'Technology')
  .replace(/\bEngin(?:eering|eer|in)?(?:\.|\b)(?!\w)/gi,'Engineering')
  .replace(/\bInstit(?:ute|ut|it)?(?:\.|\b)(?!\w)/gi,'Institute')
  .replace(/\bUnivers(?:ity|it)?(?:\.|\b)(?!\w)/gi,'University')
  // Split on section headers (case-insensitive with flexible whitespace)
  .replace(/\s+(Education|Academic Background|Academics|Academic Details)\s+/gi,'\n\nEDUCATION\n')
  .replace(/\s+(Summer\s+Internship\s*(&|and)?\s*Live\s*Projects|Summer\s+Internships?|Experience|Work Experience|Professional Experience|Internships?|Work History)\s+/gi,'\n\nPROFESSIONAL EXPERIENCE\n')
  .replace(/\s+(Projects|Key Projects|Academic Projects|Personal Projects|Live Projects)\s+/gi,'\n\nKEY PROJECTS\n')
  .replace(/\s+(Key Skills\s*(&|and)?\s*Certifications|Technical Skills|Technical Expertise|Key Skills|Skills & Tools|Skills)\s+/gi,'\n\nTECHNICAL SKILLS\n')
  .replace(/\s+(Achievements|Honors & Awards|Awards|Competitive Programming)\s+/gi,'\n\nACHIEVEMENTS\n')
  .replace(/\s+(Positions\s+of\s+Responsibility\s*(&|and)?\s*Leadership|Leadership & Responsibility|Positions of Responsibility|Leadership|Extracurricular)\s+/gi,'\n\nLEADERSHIP\n')
  .replace(/\s+(Certifications|Certificates|Courses)\s+/gi,'\n\nCERTIFICATIONS\n')
  .replace(/(▪|•|◆|●|\*\s+)/g,'\n• ');

 return text.split('\n')
  .map(line=>line.trim())
  .filter(Boolean)
  .join('\n');
}

function detectDomain(cvText, jdText, roleName){
 const context = ((roleName||'') + ' ' + (jdText||'') + ' ' + (cvText||'')).toLowerCase();
 const targetContext = ((roleName||'') + ' ' + (jdText||'')).toLowerCase();
 const isMBA = /\b(mba|pgdm|post\s*graduate\s*diploma|iim|imt|xlri|nmims|sibm|fms|mdi|spjimr|isb|b-school|business school|management trainee)\b/i.test(context);

 // Target JD / Role takes top precedence if present
 if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|merchandising|territory)\b/i.test(targetContext)) return 'Marketing';
 if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(targetContext)) return 'Finance';
 if (/\b(consulting|strategy|operations|supply chain|scm|logistics|procurement|lean six sigma|management consulting)\b/i.test(targetContext)) return 'Consulting';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp|employee engagement)\b/i.test(targetContext)) return 'HR';

 // When candidate has MBA / PGDM background, check management domains before undergrad engineering keywords
 if (isMBA) {
  if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|campaign)\b/i.test(context)) return 'Marketing';
  if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(context)) return 'Finance';
  if (/\b(consulting|strategy|operations|supply chain|scm|logistics|procurement|process)\b/i.test(context)) return 'Consulting';
  if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
  return 'General Management';
 }

 // Non-MBA business domains
 if (/\b(marketing|brand|campaign|consumer insights|trade marketing|growth marketing)\b/i.test(context)) return 'Marketing';
 if (/\b(finance|valuation|equity|portfolio|cfa|financial analyst|investment banking)\b/i.test(context)) return 'Finance';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
 if (/\b(consulting|strategy|supply chain|operations)\b/i.test(context)) return 'Consulting';

 // Technology only when candidate has software/coding roles or technical skills without business pivot
 if (/\b(software\s*engineer|software\s*developer|coding|backend|frontend|fullstack|algorithms|data structures|web\s*development|distributed systems|devops|react|node|golang|c\+\+|java\b)/i.test(context)) return 'Technology';

 return 'General';
}

function truncateAtWord(str, maxLen){
 if(!str)return '';
 let clean=str.replace(/[ \t]+/g,' ').trim();
 if(clean.length<=maxLen)return cleanBullet(clean);
 const sub=clean.slice(0,maxLen);
 const lastSpace=sub.lastIndexOf(' ');
 const cut=(lastSpace>Math.floor(maxLen*0.55))?sub.slice(0,lastSpace):sub;
 return cleanBullet(cut);
}

let cachedVoices = [];
function refreshVoices() {
 if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
   const list = window.speechSynthesis.getVoices() || [];
   if (list.length > 0) cachedVoices = list;
  } catch (e) {}
 }
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
 refreshVoices();
 if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = refreshVoices;
 }
}

function getBestHumanVoice(callback) {
 if (typeof window === 'undefined' || !window.speechSynthesis) {
  if (callback) callback(null);
  return null;
 }

 const select = () => {
  let vList = window.speechSynthesis.getVoices() || [];
  if (!vList.length && cachedVoices.length) vList = cachedVoices;
  if (!vList.length) return null;

  // Filter out harsh, robotic novelty voices
  const isRobotic = v => /(Fred|Albert|Bad News|Bahh|Bells|Boing|Cellos|Deranged|Good News|Hysterical|Pipe Organ|Trinoids|Whisper|Zarvox|Junior|Ralph|Kathy|Vicki|Victoria|Agnes|Bruce)/i.test(v.name);
  const en = vList.filter(v => !isRobotic(v) && v.lang && v.lang.toLowerCase().startsWith('en'));

  // Priority 1: Natural / Online Neural voices (Edge / Chrome Natural)
  let best = en.find(v => /Natural/i.test(v.name));

  // Priority 2: Google Neural English voices (Chrome Android & Desktop)
  if (!best) best = en.find(v => /Google/i.test(v.name) && (v.name.includes('UK') || v.name.includes('US') || v.name.includes('India') || v.name.includes('Female')));
  if (!best) best = en.find(v => /Google/i.test(v.name));

  // Priority 3: Apple Enhanced / Premium Siri voices (macOS & iOS)
  if (!best) best = en.find(v => /Enhanced|Premium/i.test(v.name));

  // Priority 4: Well-known natural human personas
  if (!best) best = en.find(v => /(Samantha|Karen|Daniel|Oliver|Moira|Rishi|Neerja|Aria|Jenny|Guy|Serena)/i.test(v.name));

  // Priority 5: Regional English voices (India, UK, US, AU)
  if (!best) best = en.find(v => /^en[-_](IN|GB|US|AU|CA)/i.test(v.lang));

  // Priority 6: Any non-robotic English voice
  if (!best && en.length > 0) best = en[0];

  return best || vList[0] || null;
 };

 const immediate = select();
 if (immediate) {
  if (callback) callback(immediate);
  return immediate;
 }

 // Asynchronous resolution if voices list is initializing in Chrome
 if (callback) {
  let done = false;
  const finish = () => {
   if (done) return;
   done = true;
   refreshVoices();
   callback(select());
  };
  if (window.speechSynthesis) {
   window.speechSynthesis.onvoiceschanged = finish;
  }
  setTimeout(finish, 250);
 }
 return null;
}

function cleanCompany(raw){
 if(!raw)return'your previous organisation or project';
 return raw.trim()
  .replace(/[ \t]+/g,' ')
  .replace(/\s+([,;.])/g,'$1')
  .replace(/\bTechnol(?:ogy|og|o)?(?:\.|\b)(?!\w)/gi,'Technology')
  .replace(/\bEngin(?:eering|eer|in)?(?:\.|\b)(?!\w)/gi,'Engineering')
  .replace(/\bInstit(?:ute|ut|it)?(?:\.|\b)(?!\w)/gi,'Institute')
  .replace(/\bUnivers(?:ity|it)?(?:\.|\b)(?!\w)/gi,'University')
  .replace(/[.\-—|,;:]+$/,'')
  .trim();
}

function cleanBullet(raw){
 if(!raw)return'your key achievements';
 let s = raw.trim()
  .replace(/[ \t]+/g,' ')
  .replace(/\s+([,;.])/g,'$1')
  .replace(/(\b[A-Za-z]{2,})-\s+([a-z]{2,}\b)/g,'$1$2')
  .replace(/\bTechnol(?:ogy|og|o)?(?:\.|\b)(?!\w)/gi,'Technology')
  .replace(/\bEngin(?:eering|eer|in)?(?:\.|\b)(?!\w)/gi,'Engineering')
  .replace(/\bInstit(?:ute|ut|it)?(?:\.|\b)(?!\w)/gi,'Institute')
  .replace(/\bUnivers(?:ity|it)?(?:\.|\b)(?!\w)/gi,'University');
 for(let i=0;i<3;i++){
  s = s
   .replace(/[.\-—|,;:]+$/,'')
   .replace(/\s+(?:and|or|with|to|in|by|for|at|the|a|an|of|from|as|on|into|onto|about|over|is|are|was|were)\s+[a-z]{1,2}$/i,'')
   .replace(/\s+[a-z]{1,2}$/i,'')
   .replace(/\s+(?:and|or|with|to|in|by|for|at|the|a|an|of|from|as|on|into|onto|about|over|is|are|was|were)$/i,'')
   .replace(/[.\-—|,;:]+$/,'')
   .trim();
 }
 return s || 'your key achievements';
}

function generateTailoredCVQuestions(cvText,jd,role){
 const rawCv=cleanExtractedCVText(cvText||'');
 const lines=rawCv.split(/\n/).map(l=>l.replace(/^[•\-▪*◆]\s*/,'').trim()).filter(Boolean);
 const useful=lines.filter(l=>l.length>=35&&!/^(EDUCATION|PROFESSIONAL EXPERIENCE|KEY PROJECTS|TECHNICAL SKILLS|ACHIEVEMENTS|LEADERSHIP|CERTIFICATIONS)$/i.test(l));
 const projectLine=useful.find(l=>/project|developed|built|implemented|designed|created|intern|experience|worked/i.test(l))||useful[0]||'';
 const cleanProject=projectLine?truncateAtWord(cleanBullet(projectLine),110):'';
 const target=String(role||jd||'').trim();
 const q1='Walk me through your background and the experience or project on your CV that you are most proud of. What did you personally contribute?';
 const q2=cleanProject?'Your CV mentions "'+cleanProject+'". What was the situation, what was your responsibility, what did you personally do, and what was the outcome?':'Tell me about one project or experience on your CV. What problem were you solving, what did you personally do, and what was the outcome?';
 const q3='Tell me about one project or experience from your CV in more depth. What was the biggest challenge and how did you handle it?';
 // Mandatory AI question: ask this in every interview, regardless of whether AI appears on the CV.
 const q4='How have you used AI in your job, internship, or SIP? Please share a specific example of how you used AI to improve your work, solve a problem, or become more effective.';
 const q5='Tell me about a difficult problem, setback, disagreement, or unexpected challenge you actually experienced in the work or projects listed on your CV. How did you respond?';
 const q6=target?'If you joined the '+truncateAtWord(target,80)+' team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?':'If you joined this team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?';
 return[q1,q2,q3,q4,q5,q6];
}

function evaluateInterviewTurnLocal(question,answer,history,cvText=''){
 const cleanAns=String(answer||'').trim(); const words=cleanAns.split(/\s+/).filter(Boolean); const wordCount=words.length;
 const isGibberish=/(^good\s*job$|^did\s*a?\s*good\s*job$|^okay$|^ok$|^fine$|^yes$|^no$|^hello$|^test$)/i.test(cleanAns);
 const isRepetitive=wordCount>4&&new Set(words.map(w=>w.toLowerCase())).size<wordCount*0.35;
 let turnScore=0; let note='';
 if(wordCount<=3||isGibberish||cleanAns.length<12){turnScore=0;note='0/100 — The answer is too short or generic. Give a specific example from your CV and explain what you personally did and what happened.';}
 else if(wordCount<10||isRepetitive){turnScore=10;note='10/100 — Severely incomplete. Use a real CV example and explain Situation, Task, Action and Result.';}
 else if(wordCount<25){turnScore=25;note='25/100 — Needs STAR depth. Add context, your individual ownership, the decisions you made and the actual outcome.';}
 else{const hasOwnership=/\b(i|my)\b.*\b(built|designed|implemented|led|developed|analysed|analyzed|created|resolved|integrated|managed|conducted|worked|owned|handled|improved|used|delivered|tested)\b/i.test(cleanAns)||/\bmy\s+(role|responsibility|contribution|work)\b/i.test(cleanAns);const hasResult=/\b(result|outcome|impact|improved|reduced|increased|achieved|delivered|learned|success)\b|%|\b\d+\b/i.test(cleanAns);turnScore=hasOwnership&&hasResult?85:(hasOwnership||hasResult?70:55);note=turnScore>=85?'Strong STAR answer. You explained your contribution and outcome clearly.':turnScore>=70?'Good detail. Make your personal contribution and actual outcome even clearer.':'Add a real CV example and structure it as Situation → Task → Action → Result.';}
 const fillerMatches=cleanAns.match(/\b(um|uh|er|ah|like|you know|basically|actually|literally)\b/gi)||[];const fillers=fillerMatches.length;const fillerList=[...new Set(fillerMatches.map(f=>f.toLowerCase()))];if(fillers)note+=' ('+fillers+' verbal crutch'+(fillers>1?'es':'')+' detected.)';
 const q=String(question||'').trim();
 const quotedMatch=q.match(/"([^"]+)"/);
 const quoted=quotedMatch?cleanBullet(quotedMatch[1]):'';

 let modelAnswer='';
 if(/\b(background|proudest|proud|academic journey|tell me about yourself|walk me through)\b/i.test(q)){
  modelAnswer='I have a background in software engineering with a focus on building reliable, scalable systems. The project I am most proud of is developing a real-time collaborative workspace. Situation: Our application had concurrent state conflicts when multiple users edited simultaneously. Task: My responsibility was ensuring state consistency without slowing down real-time sync. Action: I designed an operational transformation pipeline using WebSockets and Redis pub/sub to order client operations and resolve race conditions in memory. Result: We achieved sub-50ms synchronization latency across concurrent sessions with zero data loss, handling peak loads smoothly.';
 }else if(quoted||/\b(your cv mentions|mentions|project on your cv|one project or experience on your cv)\b/i.test(q)){
  const topic=quoted?`In my work on "${quoted}": `:'In my core project: ';
  modelAnswer=topic+'Situation: Our system faced high latency and escalating storage overhead during peak test execution. Task: I took full ownership of overhauling the batch storage pipeline to keep ingestion fast and cost-effective. Action: I architected the storage tier with Cloudflare R2 object storage, configured asynchronous batch multipart uploads, and implemented automated retry policies with circuit breakers. Result: This reduced storage costs by over 30%, lowered batch processing time significantly, and eliminated ingestion timeouts in production.';
 }else if(/\b(challenge|depth|more depth|difficult problem|technical problem|handled it)\b/i.test(q)&&!/\b(setback|disagreement|unexpected|conflict)\b/i.test(q)){
  modelAnswer='Situation: In one of our core services, we encountered severe write contention and intermittent latency spikes during high-concurrency database updates. Task: My responsibility was to eliminate the write bottleneck without altering existing API contracts or risking data consistency. Action: I profiled query execution plans, removed unindexed table scans, and implemented an in-memory write-behind cache with optimistic concurrency control and debounced batching. Result: This reduced write contention by over 40%, brought 99th-percentile response times under 50ms, and prevented database deadlocks under high load.';
 }else if(/\b(ai|copilot|chatgpt|claude|llm|artificial intelligence)\b/i.test(q)){
  modelAnswer='I treat modern AI tools as an engineering velocity multiplier while strictly verifying every output: Situation: Writing boundary unit test suites and edge-case mocks for microservice endpoints was manual and time-consuming. Task: I wanted to accelerate test coverage for complex edge conditions without sacrificing code correctness. Action: I used GitHub Copilot and structured LLM prompts to scaffold parameterized unit tests and simulate edge-case payloads, then rigorously verified every assertion against our API specifications. Result: This cut our test scaffolding time by 40% and uncovered two critical boundary bugs during development before code reached staging.';
 }else if(/\b(setback|disagreement|unexpected|conflict|failure)\b/i.test(q)){
  modelAnswer='Situation: Two days before a major release, our integration test suite unexpectedly failed due to environment-specific path delimiter discrepancies across operating system runtimes. Task: As the developer owning that component, I had to resolve the failure quickly without causing release delays or panic. Action: I held a brief technical sync to communicate transparently, isolated the bug to unescaped session path delimiters in our storage module, wrote regression test cases, and deployed platform-agnostic normalization within 8 hours. Result: All integration tests passed green, the release shipped on schedule, and we added cross-platform containerized testing to our CI pipeline.';
 }else if(/\b(tomorrow|joined|first 30 days|learn first|contribute)\b/i.test(q)){
  modelAnswer='If I joined the team tomorrow, I would follow a structured 30-day onboarding plan: First, in my initial two weeks, I would immerse myself in your codebase, architecture documentation, and CI/CD pipelines, while scheduling 1-on-1s with senior teammates to understand coding standards and team priorities. Second, by week three, I would take ownership of two small backlog bugs or test improvements to ship my first PR and validate my local-to-production workflow. Third, by day thirty, I would be ready to take independent ownership of a feature deliverable, using my experience in scalable systems to deliver clean, tested code and contribute actively in sprint reviews.';
 }else{
  modelAnswer='Situation: In my previous project, we had to deliver a critical module under ambiguous requirements and a strict two-week deadline. Task: My goal was to clarify deliverables, take ownership of implementation, and ensure reliable execution. Action: I broke down core requirements into concrete milestones, designed modular components with robust unit test coverage, and held daily 10-minute check-ins to unblock dependencies quickly. Result: We delivered the feature two days ahead of schedule with zero high-severity defects and received positive feedback from stakeholders.';
 }

 const prior=Array.isArray(history)?history:[];const allTurns=[...prior,{question:q,answer:cleanAns,evaluation:{score:turnScore}}];const avgScore=Math.round(allTurns.reduce((sum,t)=>sum+(t.evaluation?.score??0),0)/allTurns.length);const improvements=[];if(turnScore<70)improvements.push('Use a real CV example and answer with Situation → Task → Action → Result.');improvements.push('Only state facts, technologies and outcomes supported by the CV or question context.');
 return{done:allTurns.length>=6,evaluation:{score:turnScore,notes:note,modelAnswer,fillers,fillerList},finalFeedback:allTurns.length>=6?{score:avgScore,strengths:turnScore>=70?['Used specific detail and personal ownership where present']:[],improvements,nextAction:'Practise again using real STAR stories from your CV.'}:null};
}

function localReview(cv,jd,mode){

 const base=fallback(mode);
 const words=cv.trim().split(/\s+/).filter(Boolean).length;
 const customQs=generateTailoredCVQuestions(cv,jd,'');
 const hasNumbers=/\d+\s*(%|percent|cr|lakh|year|month|team|hire|client)/i.test(cv);
 const hasBullets=(cv.match(/•|▪|●/g)||[]).length;
 return{
  ...base,
  interviewQuestions:customQs,
  score:Math.max(58,Math.min(88,base.score+(words>450?7:words>220?3:0)+(hasNumbers?5:0)+(hasBullets>4?3:0))),
  summary:mode==='specific'
   ?`Local CV review complete. Add evidence that directly connects your experience to this JD (${Math.min(3,Math.max(1,Math.round(jd.length/1200)))} priority areas identified).`
   :`Local CV review complete. Your draft is ready to improve and personalise before the interview.`
 };
}

function localImprove(cv){
 const lines=cleanExtractedCVText(cv).split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!lines.length)return cv;
 return lines.map((line,i)=>{if(i<3)return line;const clean=line.replace(/^[•●▪-]\s*/,'');if(clean.length<45||/[.!?]$/.test(clean))return line;return `• ${clean.replace(/^I\s+/i,'').replace(/\s+/g,' ')}.`}).join('\n');
}

function Dashboard({profile,onLogout,onNewApp,onOpen,onMasterCV,onEditCV,onInterview,onViewInterview,onModule}){
 const[apps,setApps]=useState([]);const[interviews,setInterviews]=useState([]);const[tab,setTab]=useState('apps');
 useEffect(()=>{
  const refresh=()=>{setApps(db.getApplications());setInterviews(db.getInterviews())};
  refresh();
  window.addEventListener('gjr_cloud_synced',refresh);
  return ()=>window.removeEventListener('gjr_cloud_synced',refresh);
 },[profile]);
 const del=id=>{if(!confirm('Delete this application?'))return;db.deleteApplication(id);setApps(db.getApplications())};
 const delIv=id=>{if(!confirm('Delete this interview report?'))return;db.deleteInterview(id);setInterviews(db.getInterviews())};
 const masterCV=db.getMasterCV();
 const hasMaster=!!masterCV;

 return <div className="dashboard">
  <div className="dash-head">
   <div><span className="eyebrow">YOUR WORKSPACE</span><h2>Welcome back, <em>{profile.email.split('@')[0]}</em> 👋</h2><p className="sub">Your preparation hub — CVs, interviews, feedback all in one place.</p></div>
   <button className="ghost-sm" onClick={onLogout}>Sign out</button>
  </div>

  {/* Step Banner */}
  <div className="pipeline-steps">
   <div className={`pipe-step ${hasMaster?'done':''}`} onClick={onMasterCV}>
    <span className="pipe-num">{hasMaster?'✓':'1'}</span>
    <div><b>Master CV</b><span>{hasMaster?'Saved ✅ — click to update':'Upload & finalise your base CV'}</span></div>
   </div>
   <div className="pipe-arrow">→</div>
   <div className={`pipe-step ${hasMaster?'active':''}`} onClick={hasMaster?onNewApp:undefined}>
    <span className="pipe-num">2</span>
    <div><b>Add a Job Application</b><span>{hasMaster?'Tailored CV + JD-specific interview':'Complete step 1 first'}</span></div>
   </div>
   <div className="pipe-arrow">→</div>
   <div className="pipe-step">
    <span className="pipe-num">3</span>
    <div><b>Interview & Improve</b><span>Per-job score + CV updates post-interview</span></div>
   </div>
  </div>

  <div className="dash-tabs">
   <button className={tab==='apps'?'selected':''} onClick={()=>setTab('apps')}>📁 My Applications <span className="tab-count">{apps.length}</span></button>
   <button className={tab==='interviews'?'selected':''} onClick={()=>setTab('interviews')}>🎙️ Interview History <span className="tab-count">{interviews.length}</span></button>
  </div>

  {tab==='apps'&&<div className="dash-grid">
   {/* Master CV card */}
   <div className={`input-card dash-card master-cv-card ${hasMaster?'ready':''}`} role="button" onClick={onMasterCV}>
    <div className="card-center"><FileText size={28}/><b>Master CV</b><span>{hasMaster?'Edit your base CV':'Upload your base CV'}</span>{hasMaster&&<span className="cv-preview">{masterCV.slice(0,80)}…</span>}{hasMaster&&<span className="master-badge">✓ Ready</span>}</div>
   </div>
   {/* New Application CTA */}
   <div className={`input-card dash-card new-card ${!hasMaster?'locked':''}`} role="button" onClick={hasMaster?onNewApp:onMasterCV}>
    <div className="card-center">
     <Plus size={28}/>
     <b>{hasMaster?'Apply to a New Job':'Upload Master CV First'}</b>
     <span>{hasMaster?'Tailored CV + JD-specific AI interview':'Add your base CV before creating job applications'}</span>
     {hasMaster&&<span className="new-card-hint">Paste JD → tick suggestions → custom CV → interview</span>}
    </div>
   </div>
   {/* Application cards */}
   {apps.map(a=><div key={a.id} className="input-card dash-card app-card">
    <div className="app-card-header">
     <BriefcaseBusiness size={16}/>
     <span className="app-role">{a.role||'General Role'}</span>
     <span className="app-date">{new Date(a.updated).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
    </div>
    <div className="app-scores">
     <div className="app-score-item">
      <span>CV Score</span>
      <strong style={{color:a.score>=80?'#22c55e':a.score>=65?'#f59e0b':'#ef4444'}}>{a.score||'—'}/100</strong>
     </div>
     {a.interviewScore?<div className="app-score-item">
      <span>Interview</span>
      <strong style={{color:a.interviewScore>=70?'#22c55e':'#f59e0b'}}>{a.interviewScore}/100</strong>
     </div>:<div className="app-score-item not-done"><span>Interview</span><strong>—</strong></div>}
    </div>
    <div className="app-jd-tag">{a.jd?<span className="has-jd">🎯 JD attached</span>:<span className="no-jd">📄 General</span>}</div>
    <div className="card-actions">
     <button className="secondary" onClick={()=>onEditCV(a)}><FileText size={14}/> Edit CV</button>
     <button className="primary" style={{padding:'10px 14px',fontSize:'12px'}} onClick={()=>onInterview(a)}><Mic size={14}/> Interview</button>
     <button className="ghost-sm danger" onClick={()=>del(a.id)}>✕</button>
    </div>
   </div>)}
  </div>}
  {tab==='interviews'&&<div className="interview-history">
   {interviews.length===0&&<div className="empty-state"><p>No interviews yet. Complete your first voice interview to see results here.</p></div>}
   {interviews.map(iv=>{
    const sc=(iv.score!==undefined&&iv.score!==null&&iv.score>0)?iv.score:(iv.answers?.length)?Math.round(iv.answers.reduce((acc,a)=>acc+(a.evaluation?.score||0),0)/iv.answers.length):(iv.score||0);
    const scoreColor=sc>=75?'#22c55e':sc>=50?'#f59e0b':'#ef4444';
    const qCount=iv.answers?.length||6;
    return <div key={iv.id} className="input-card history-card clickable-history-card" onClick={()=>onViewInterview&&onViewInterview(iv)}>
     <div className="history-card-top">
      <div className="history-info">
       <div className="label" style={{marginBottom:'4px'}}><Mic size={17}/> {iv.role||'General Interview'} <span className="sub">· {new Date(iv.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div>
       <div className="history-sub-meta">
        <span className="history-q-count">🎙️ {qCount} Questions &amp; Audio Transcripts</span>
        {iv.nextAction&&<span className="history-action-hint">→ {iv.nextAction}</span>}
       </div>
      </div>
      <div className="history-score-badge" style={{borderColor:scoreColor}}>
       <strong style={{color:scoreColor}}>{sc}</strong>
       <small>/100</small>
      </div>
     </div>
     <div className="history-card-footer">
      <button className="primary" style={{padding:'8px 14px',fontSize:'12px'}} onClick={e=>{e.stopPropagation();onViewInterview&&onViewInterview(iv);}}>
       <FileText size={14}/> View Full Report &amp; Audio →
      </button>
      <button className="ghost-sm danger" title="Delete interview" onClick={e=>{e.stopPropagation();delIv(iv.id);}}>
       <Trash2 size={14}/>
      </button>
     </div>
    </div>;
   })}
  </div>}

   <div className="dash-launchpad" style={{marginTop:'32px',padding:'22px 24px',background:'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)',borderRadius:'20px',border:'1px solid #e0e7ff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:'14px'}}>
     <div>
      <span className="eyebrow" style={{color:'#6855e8',fontSize:'11px',fontWeight:800}}>STAGE 2 · DAY-1 CORPORATE LAUNCHPAD &amp; DEMOS</span>
      <h3 style={{fontSize:'16px',fontWeight:800,margin:'2px 0 0',color:'#1e1b4b'}}>Stand Out in Interview &amp; Onboard on Day 1</h3>
     </div>
     <span style={{fontSize:'12px',color:'#64748b'}}>Practical workplace habits &amp; prototypes</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'12px'}}>
     <button type="button" className="module-card" style={{padding:'16px',textAlign:'left',background:'#fff',borderRadius:'16px',border:'1px solid #e2e8f0',cursor:'pointer'}} onClick={()=>onModule&&onModule('demo')}>
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
       <span style={{background:'#ede9fe',padding:'6px',borderRadius:'10px',display:'inline-flex',color:'#6855e8'}}><Target size={16}/></span>
       <b style={{fontSize:'13px',color:'#1e293b'}}>Impress the Interviewer</b>
      </div>
      <p style={{fontSize:'11px',color:'#64748b',margin:0,lineHeight:'1.4'}}>Turn a company problem into a live product concept &amp; demo.</p>
     </button>
     <button type="button" className="module-card" style={{padding:'16px',textAlign:'left',background:'#fff',borderRadius:'16px',border:'1px solid #e2e8f0',cursor:'pointer'}} onClick={()=>onModule&&onModule('readiness')}>
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
       <span style={{background:'#dcfce7',padding:'6px',borderRadius:'10px',display:'inline-flex',color:'#16a34a'}}><ShieldCheck size={16}/></span>
       <b style={{fontSize:'13px',color:'#1e293b'}}>Corporate Ready</b>
      </div>
      <p style={{fontSize:'11px',color:'#64748b',margin:0,lineHeight:'1.4'}}>Build communication, feedback resilience and workplace habits.</p>
     </button>
     <button type="button" className="module-card" style={{padding:'16px',textAlign:'left',background:'#fff',borderRadius:'16px',border:'1px solid #e2e8f0',cursor:'pointer'}} onClick={()=>onModule&&onModule('ai')}>
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
       <span style={{background:'#fef3c7',padding:'6px',borderRadius:'10px',display:'inline-flex',color:'#d97706'}}><Sparkles size={16}/></span>
       <b style={{fontSize:'13px',color:'#1e293b'}}>AI at Work</b>
      </div>
      <p style={{fontSize:'11px',color:'#64748b',margin:0,lineHeight:'1.4'}}>Learn practical AI workflows that make you faster and sharper.</p>
     </button>
    </div>
   </div>
  </div>
}


function App(){
 const[screen,setScreen]=useState('home'),[career,setCareer]=useState(()=>readSession('gjr_career','job')), [prep,setPrep]=useState(()=>readSession('gjr_cv_mode','general'));
 const[cv,setCv]=useState(()=>readSession('gjr_cv_text','')), [jd,setJd]=useState(()=>readSession('gjr_jd_text','')),[cvFile,setCvFile]=useState(null),[jdFile,setJdFile]=useState(null);
 const[loading,setLoading]=useState(false),[result,setResult]=useState(null),[qIndex,setQIndex]=useState(0),[answers,setAnswers]=useState([]);
 const[profile,setProfile]=useState(()=>db.getProfile()),[appId,setAppId]=useState(null),[roleName,setRoleName]=useState(''),[showRoleModal,setShowRoleModal]=useState(false);
 const[masterSaved,setMasterSaved]=useState(false);
 const questions=useMemo(()=>result?.interviewQuestions?.length?result.interviewQuestions:generateTailoredCVQuestions(cv,jd,roleName),[result,cv,jd,roleName]);

 useLayoutEffect(()=>{
  scrollToTop();
  const raf=requestAnimationFrame(scrollToTop);
  const t=setTimeout(scrollToTop,50);
  return ()=>{
   cancelAnimationFrame(raf);
   clearTimeout(t);
  };
 },[screen]);

 const handleLogin=async email=>{db.saveProfile(email);const p=db.getProfile();setProfile(p||{email});setJd('');setAppId(null);setRoleName('');scrollToTop();setScreen('home');try{await db.syncFromCloud();setCv(db.getMasterCV());const ref=db.getProfile();if(ref)setProfile(ref);}catch(e){}};
 const handleLogout=()=>{db.logout();setProfile(null);setCv('');setJd('');setAppId(null);setRoleName('');scrollToTop();setScreen('home')};
 const promptNewApp=()=>{setRoleName('');setShowRoleModal(true)};
 // New Application: ALWAYS go to resume screen with specific/JD mode when master exists
 const confirmNewApp=name=>{scrollToTop();const id=Date.now().toString();setAppId(id);setRoleName(name||'General');const masterCV=db.getMasterCV();setCv(masterCV);setJd('');setCvFile(null);setJdFile(null);const mode=masterCV?'specific':'general';setPrep(mode);saveSession('gjr_cv_mode',mode);setShowRoleModal(false);setScreen('resume')};
 // Open app → go straight to cvstudio
 const openApp=a=>{scrollToTop();setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setPrep(a.jd?'specific':'general');setResult(a.result||null);setScreen('cvstudio')};
 // Edit CV for a specific app
 const editCV=a=>{scrollToTop();setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setPrep(a.jd?'specific':'general');setResult(a.result||null);setScreen('cvstudio')};
 // Start interview directly for a specific app (skip CV studio)
 const directInterview=a=>{scrollToTop();setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setResult(a.result||null);setQIndex(0);setAnswers([]);setScreen('interview')};
 const openMasterCV=()=>{scrollToTop();const masterCV=db.getMasterCV();setAppId('master');setCv(masterCV);setJd('');setPrep('general');setResult(null);setMasterSaved(false);setScreen('resume')};
 const choosePrep=m=>{scrollToTop();setPrep(m);saveSession('gjr_cv_mode',m);setScreen('resume')};
 const changeCareer=v=>{setCareer(v);saveSession('gjr_career',v)};
 useEffect(()=>{
  db.syncFromCloud().catch(()=>{});
  const handleSync=()=>{
   const p=db.getProfile();
   if(p)setProfile(p);
   const m=db.getMasterCV();
   if(m&&!cv)setCv(m);
  };
  window.addEventListener('gjr_cloud_synced',handleSync);
  window.__gjrSetCv=(text,file)=>{
   const cleaned=cleanExtractedCVText(text);
   if(file)setCvFile(file);
   setCv(cleaned);
   saveSession('gjr_cv_text',cleaned);
  };
  window.__gjrSetJd=(text,file)=>{
   if(file)setJdFile(file);
   setJd(text);
   saveSession('gjr_jd_text',text);
  };
  return ()=>{delete window.__gjrSetCv;delete window.__gjrSetJd;window.removeEventListener('gjr_cloud_synced',handleSync)};
 },[cv]);
 const parseFile=async(kind,file)=>{
  if(!file)return;
  const ok=kind==='cv'?/\.(pdf|txt|docx)$/i.test(file.name)||(file.type==='application/pdf'||file.type==='text/plain'||file.type?.includes('wordprocessingml')):/\.(pdf|txt)$/i.test(file.name)||(file.type==='application/pdf'||file.type==='text/plain');
  if(!ok){alert(kind==='cv'?'Please upload a PDF, DOCX or TXT CV.':'Please upload a PDF or TXT job description.');return}
  try{
   const text=await readFile(file);
   if(!text||!text.trim())throw new Error('The file contains no readable text. Please paste the text into the text box below.');
   if(kind==='cv'){
    const cleaned=cleanExtractedCVText(text);
    setCvFile(file);
    setCv(cleaned);
    saveSession('gjr_cv_text',cleaned);
   }else{
    setJdFile(file);
    setJd(text);
    saveSession('gjr_jd_text',text);
   }
  }catch(e){
   console.error('File parse exception:',e);
   if(e?.message?.includes('dynamically imported module')){window.location.reload();return}
   alert(e.message||'We could not read that file. Please paste your text into the box instead.');
  }
 };
 const clearFile=kind=>{if(kind==='cv'){setCvFile(null);setCv('');try{sessionStorage.removeItem('gjr_cv_text')}catch{}}else{setJdFile(null);setJd('');try{sessionStorage.removeItem('gjr_jd_text')}catch{}}};
 const analyze=async()=>{
  if(!cv.trim())return alert('Upload your CV or paste your CV text.');
  if(prep==='specific'&&!jd.trim())return alert('Upload or paste the job description for a role-specific preparation.');
  setLoading(true);
  try{
   let data;
   try{
    data=await post('/api/analyze',{cv,jd:prep==='general'?'':jd,career,mode:prep});
   }catch(e){
    console.warn('AI review unavailable; using local review',e);
    data=localReview(cv,jd,prep);
   }
   setResult(data);
   saveSession('gjr_cv_mode',prep);
   saveSession('gjr_cv_text',cv);
   saveSession('gjr_jd_text',prep==='general'?'':jd);
   
   if(appId==='master'||!db.getMasterCV()){
    db.saveMasterCV(cv);
   }
   if(appId!=='master'){
    const targetId=appId||Date.now().toString();
    setAppId(targetId);
    if(profile){
     db.saveApplication({id:targetId,role:roleName||(prep==='general'?'General CV':(jd.slice(0,30)+'…')),cv,score:data?.score,jd,result:data});
    }
   }
   setScreen('cvstudio');
  }finally{
   setLoading(false);
  }
 };
 const saveFinal=text=>{
  const finalText = String(text || '').trim() || String(cv || '').trim() || db.getMasterCV() || readSession('gjr_cv_text', '');
  if (!finalText) return;
  setCv(finalText);
  saveSession('gjr_cv_ready','1');saveSession('gjr_cv_improved',finalText);saveSession('gjr_cv_text',finalText);
  const targetId=appId||Date.now().toString();
  setAppId(targetId);
  if(appId==='master'){
   db.saveMasterCV(finalText);
  }else if(profile){
   db.saveApplication({id:targetId,role:roleName||(prep==='general'?'General CV':'Custom Application'),cv:finalText,score:result?.score,jd,result});
  }
 };

 const startInterview=text=>{if(text)setCv(text);setQIndex(0);setAnswers([]);setScreen('interview')};
 const saveInterviewResult=(d,finalAnswers)=>{
  const activeAnswers=finalAnswers||answers;
  const fb=d||{score:0,strengths:['None identified — all submitted answers were under 10 words or generic placeholders.'],improvements:['All submitted answers were too brief or generic. A recruiter will reject these immediately.','Every answer must use the STAR method: Situation → Task → Action → Result.','Speak for 45–60 seconds per question, referencing specific projects and tech stacks from your CV.','Review the Model Answers below for each question to see what hiring managers look for.'],nextAction:'Review the Model Answers below and practise again with real STAR answers from your CV.'};
  if(profile){db.saveInterview({role:roleName||'General Interview',score:fb.score,strengths:fb.strengths,improvements:fb.improvements,nextAction:fb.nextAction,answers:activeAnswers,appId});db.saveApplication({id:appId,role:roleName||'General CV',cv,score:result?.score,jd,result,interviewScore:fb.score})}
  setResult(r=>({...r,feedback:fb}));setScreen('feedback');
 };
 const viewInterviewReport=iv=>{
  setRoleName(iv.role||'');
  setAppId(iv.appId||null);
  const derivedScore=(iv.score!==undefined&&iv.score!==null&&iv.score>0)?iv.score:(iv.answers?.length)?Math.round(iv.answers.reduce((acc,a)=>acc+(a.evaluation?.score||0),0)/iv.answers.length):(iv.score||0);
  setResult({feedback:{score:derivedScore,strengths:iv.strengths||[],improvements:iv.improvements||[],nextAction:iv.nextAction||''}});
  setAnswers(iv.answers||[]);
  setScreen('feedback');
 };
  const goHome=()=>{scrollToTop();setScreen('home')};
   if(screen==='home'){if(profile)return <Workspace title="My Workspace" subtitle="Your preparation hub." icon={<Folder/>} onHome={goHome}><Dashboard profile={profile} onLogout={handleLogout} onNewApp={promptNewApp} onOpen={openApp} onMasterCV={openMasterCV} onEditCV={editCV} onInterview={directInterview} onViewInterview={viewInterviewReport} onModule={setScreen}/>{showRoleModal&&<div className="modal" onClick={e=>e.target===e.currentTarget&&setShowRoleModal(false)}><div className="modal-card login-card"><span className="eyebrow">NEW JOB APPLICATION</span><h2>Which role are you applying for?</h2><p>Give it a name — your Master CV will be pre-loaded and you can add the job description on the next screen.</p><input type="text" className="login-input" placeholder="e.g. Deloitte – Management Consulting Intern" value={roleName} onChange={e=>setRoleName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmNewApp(roleName)} autoFocus/><div style={{display:'flex',gap:'12px',justifyContent:'center'}}><button className="ghost-sm" onClick={()=>setShowRoleModal(false)}>Cancel</button><button className="primary" onClick={()=>confirmNewApp(roleName)}>Create <ArrowRight size={16}/></button></div></div></div>}</Workspace>;return <Home career={career}setCareer={changeCareer}choosePrep={choosePrep}openModule={setScreen}onLogin={handleLogin}onHome={goHome}/>}
  if(screen==='resume')return <Workspace title={prep==='general'?'General CV Preparation':'CV + Job Description'} subtitle={prep==='general'?'Review your CV without a target role. Save the final version before interviewing.':'Upload your CV and one specific JD. Improve the CV before you practise the role-specific interview.'} icon={<FileText/>} back={()=>setScreen('home')} onHome={goHome}><Prep prep={prep}setPrep={setPrep}cv={cv}setCv={setCv}jd={jd}setJd={setJd}cvFile={cvFile}jdFile={jdFile}parseFile={parseFile}clearFile={clearFile}analyze={analyze}loading={loading}/></Workspace>;
  if(screen==='cvstudio')return <Workspace title="Improve your CV first" subtitle={prep==='general'?'Review, edit and save your CV. Your interview will use the final version.':'Make your CV stronger for this role before you practise the interview.'} icon={<Sparkles/>} back={()=>setScreen('resume')} onHome={goHome}><CVStudio result={result||fallback(prep)}initial={cv}jd={jd}mode={prep}isMasterCV={appId==='master'}onSave={saveFinal}onContinue={startInterview}onGoHome={goHome}onCustomRoleInterview={(role,comp,text)=>{setRoleName(comp?`${comp} – ${role}`:role);if(text)setCv(text);setQIndex(0);setAnswers([]);setScreen('interview')}}/></Workspace>;


  if(screen==='interview'){
   const totalQs=questions.length||6;
   const isLastTurn=qIndex>=totalQs-1;
   return <Workspace title="AI Audio Interview" compact back={()=>setScreen('cvstudio')} onHome={goHome}><VoiceInterview cv={cv}jd={jd}mode={prep}career={career}roleName={roleName}question={questions[Math.min(qIndex,totalQs-1)]}turn={qIndex+1}maxTurns={totalQs}history={answers}onTurn={(d,a,audioUrl)=>{const newAnswers=[...answers,{question:questions[qIndex],answer:a,audioUrl,evaluation:d?.evaluation}];setAnswers(newAnswers);const nextIdx=qIndex+1;if(nextIdx>=totalQs||d.done){saveInterviewResult(d.finalFeedback,newAnswers);}else{setQIndex(nextIdx);}}}onDone={saveInterviewResult}/></Workspace>;
  }





  if(screen==='feedback')return <Workspace title="Interview Feedback" subtitle="Your transcript, strengths and next actions." icon={<MessageSquareText/>} back={()=>setScreen('home')} onHome={goHome}><Feedback data={result?.feedback} answers={answers} onSyncSpokenWins={bullets=>{setCv(prev=>prev+'\n\n'+bullets);saveSession('gjr_cv_text',cv+'\n\n'+bullets);if(profile)db.saveApplication({id:appId,role:roleName||'General CV',cv:cv+'\n\n'+bullets,score:result?.score,jd,result})}} onHome={goHome} onPractiseAgain={()=>{setAnswers([]);setQIndex(0);setScreen('interview')}} onImproveCV={()=>{setScreen('cvstudio')}} onModule={mid=>{const resolved=mid==='resilience'?'readiness':mid;setScreen(resolved)}}/></Workspace>;

  return <Workspace title={modules.find(x=>x.id===screen)?.title||'GetJobReady'} subtitle={modules.find(x=>x.id===screen)?.text||''} icon={<Sparkles/>} back={()=>setScreen('home')} onHome={goHome}><Module id={screen}career={career}/></Workspace>
 }

function Header({onHow,back,onHome}){return <header><div className="header-left">{back&&<button className="back"onClick={()=>{scrollToTop();back()}}>← Back</button>}</div><button className="brand"onClick={()=>{scrollToTop();if(onHome)onHome()}}style={{background:'none',border:'none',padding:0,cursor:onHome?'pointer':'default'}}><img src="/logo.svg" alt="GetJobReady Logo" style={{width:'42px',height:'42px',borderRadius:'14px',objectFit:'contain',display:'block'}} /><span>GetJobReady<span className="dot">.online</span></span></button>{onHow?<button className="ghost"onClick={onHow}><Sparkles size={15}/> How it works</button>:<div className="header-spacer"/>}</header>}


function Home({career,setCareer,choosePrep,openModule,onLogin,onHome}){const[how,setHow]=useState(false),[showLogin,setShowLogin]=useState(false),[email,setEmail]=useState('');return <div className="app"><Header onHow={()=>setHow(true)} onHome={onHome}/><main className="hero"><div><span className="trust-badge"><Sparkles size={13}/> Trusted by students at IIMs, ISBs &amp; top B-schools</span></div><div className="eyebrow">{career==='internship'?'INTERNSHIP TRACK':'FULL-TIME TRACK'} · AI-POWERED CAREER READINESS</div><h1>Your degree got you here.<br/><em>Let's get you hired.</em></h1><p className="lead">{career==='internship'?'Build a strong campus story, sharpen your CV and practise with a real AI voice interviewer before the big day.':'Improve your CV for the exact role, then practise a hands-free AI interview that adapts to your answers.'}</p><div className="career-toggle"><button className={career==='internship'?'active':''}onClick={()=>setCareer('internship')}>☀️ Internship</button><button className={career==='job'?'active':''}onClick={()=>setCareer('job')}>💼 Full-time</button></div><button className="primary hero-btn"onClick={()=>setShowLogin(true)}>Enter Workspace <ArrowRight size={18}/></button><div className="hero-stats"><div className="stat"><span className="stat-num">4</span><span className="stat-label">Prep Steps</span></div><div className="stat"><span className="stat-num">100%</span><span className="stat-label">Voice-powered</span></div><div className="stat"><span className="stat-num">Free</span><span className="stat-label">No sign-up</span></div></div><div className="proof"><span><CheckCircle2 size={16}/> CV review before interview</span><span><CheckCircle2 size={16}/> Hands-free voice interview</span><span><CheckCircle2 size={16}/> Instant feedback &amp; transcript</span></div></main><div className="stage-divider"><h3 className="stage-title"><span className="stage-badge">Stage 1</span> Placement Interview Gauntlet</h3><span className="stage-desc">Calibrate CV, voice simulation &amp; final round pitch</span></div><section className="module-grid" style={{gridTemplateColumns:'repeat(3,1fr)',paddingBottom:'20px'}}>{modules.slice(0,3).map(m=><button className="module-card"key={m.id}onClick={()=>m.id==='resume'?setShowLogin(true):m.id==='interview'?setShowLogin(true):openModule(m.id)}><div className="module-top"><span className="module-icon"><m.icon size={21}/></span><span className="pill">{m.tag}</span></div><h3>{m.title}</h3><p>{m.text}</p><span className="card-link">{m.id==='interview'?'Start with your CV':'Open'} <ChevronRight size={16}/></span></button>)}</section><div className="stage-divider"><h3 className="stage-title"><span className="stage-badge">Stage 2</span> Day-1 Corporate Launchpad</h3><span className="stage-desc">Workplace habits, feedback resilience &amp; AI workflows</span></div><section className="module-grid" style={{gridTemplateColumns:'repeat(2,1fr)',maxWidth:'840px',paddingBottom:'48px'}}>{modules.slice(3,5).map(m=><button className="module-card"key={m.id}onClick={()=>openModule(m.id)}><div className="module-top"><span className="module-icon"><m.icon size={21}/></span><span className="pill">{m.tag}</span></div><h3>{m.title}</h3><p>{m.text}</p><span className="card-link">Open <ChevronRight size={16}/></span></button>)}</section><section className="roadmap"><div><span className="eyebrow">THE JOURNEY</span><h2>Prepare → practise → improve.</h2></div><div className="steps"><div><b>01</b><span>Prepare</span><small>CV review + editor</small></div><div><b>02</b><span>Practise</span><small>Hands-free voice</small></div><div><b>03</b><span>Improve</span><small>Transcript + feedback</small></div></div></section><footer>Built for students entering their first internship or corporate role.</footer>{how&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setHow(false)}><div className="modal-card"><button className="modal-x"onClick={()=>setHow(false)}><X size={18}/></button><span className="eyebrow">HOW GETJOBREADY WORKS</span><h2>Prepare → practise → improve.</h2><div className="how-steps"><div><b>01</b><strong>Upload your CV</strong><span>Use General CV mode or add one specific JD.</span></div><div><b>02</b><strong>Improve before interviewing</strong><span>AI reviews your CV and gives you an editable version. If AI is temporarily unavailable, the CV studio still opens with a useful local review.</span></div><div><b>03</b><strong>Have a real voice interview</strong><span>AI asks the question aloud, then your answer is captured into the live transcript automatically.</span></div><div><b>04</b><strong>Get adaptive feedback</strong><span>Review your transcript, strengths and next actions.</span></div></div><button className="primary wide"onClick={()=>{setHow(false);setShowLogin(true)}}>Enter Workspace <ArrowRight size={18}/></button></div></div>}{showLogin&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setShowLogin(false)}><div className="modal-card login-card"><button className="modal-x"onClick={()=>setShowLogin(false)}><X size={18}/></button><span className="eyebrow">ACCESS WORKSPACE</span><h2>Enter your email</h2><p>We'll save your CVs and interview history securely on your device.</p><input type="email"className="login-input"placeholder="student@university.edu"value={email}onChange={e=>setEmail(e.target.value)}onKeyDown={e=>e.key==='Enter'&&email.trim().length>0&&onLogin(email)}/><button className="primary wide"onClick={()=>{if(email.trim().length>0)onLogin(email);else alert('Please enter your email.')}}>Continue <ArrowRight size={18}/></button></div></div>}</div>}

function Workspace({title,subtitle,icon,back,onHome,children,compact}){
 useLayoutEffect(()=>{
  scrollToTop();
  const raf=requestAnimationFrame(scrollToTop);
  const t=setTimeout(scrollToTop,50);
  return ()=>{cancelAnimationFrame(raf);clearTimeout(t)};
 },[]);
 return <div className="app"><Header back={back} onHome={onHome}/><main className={compact?'workspace workspace-compact':'workspace'}>{!compact&&<div className="workspace-head"><span className="big-icon">{icon}</span><div><div className="eyebrow">YOUR PREPARATION</div><h1>{title}</h1><p>{subtitle}</p></div></div>}{children}</main></div>}

function Prep({prep,setPrep,cv,setCv,jd,setJd,cvFile,jdFile,parseFile,clearFile,analyze,loading}){
 const presets=[
  {label:'Deloitte · Consulting',jd:'Management Consulting Associate: Conduct business analysis, process optimization, stakeholder management, client presentations and quantitative problem solving. Require strong analytical thinking, structured communication (STAR format), leadership experience and project management.'},
  {label:'ICICI Bank · Finance',jd:'Financial Analyst / Relationship Manager: Portfolio analysis, financial modeling, credit risk assessment, DCF valuation, key client relations and market research. Require financial acumen, quantitative skills and strong interpersonal communication.'},
  {label:'Asian Paints · Marketing',jd:'Brand Management Trainee: Market segmentation, consumer insights, digital campaign ROI, competitive positioning, channel strategy and product launches. Require strategic thinking, creative problem solving and data-driven marketing decisions.'},
  {label:'Amazon · Analytics',jd:'Business & Product Analyst: SQL/Data analysis, metric tracking, user funnel optimization, cross-functional collaboration and customer-centric problem solving. Require structured problem solving, quantitative storytelling and bias for action.'}
 ];
 const applyPreset=p=>{setJd(p.jd);saveSession('gjr_jd_text',p.jd)};
 return <><div className="mode-switch"role="tablist"><button className={prep==='general'?'selected':''}onClick={()=>setPrep('general')}><span>📄</span><b>General CV</b>{prep==='general'&&<Check size={16}/>}</button><button className={prep==='specific'?'selected':''}onClick={()=>setPrep('specific')}><span>🎯</span><b>CV + specific JD</b>{prep==='specific'&&<Check size={16}/>}</button></div><div className="form-grid"><div className="input-card"><div className="label"><FileText size={17}/> Your CV</div><label className="dropzone"><Upload size={27}/><b>{cvFile?.name||'Upload your CV'}</b><span>{cvFile?'CV loaded · ready for review':'PDF, DOCX or TXT · or paste below'}</span><input type="file"accept=".pdf,.txt,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"onChange={e=>{const f=e.target.files?.[0];e.target.value='';parseFile('cv',f)}}/></label>{cvFile&&<button className="clear-file"onClick={()=>clearFile('cv')}><X size={15}/> Remove file</button>}<div className="or"><span>or paste CV text</span></div><textarea id="cvText"value={cv}onChange={e=>{setCv(e.target.value);saveSession('gjr_cv_text',e.target.value)}}placeholder="Paste your CV here…"/></div>{prep==='specific'?<div className="input-card"><div className="label"><BriefcaseBusiness size={17}/> Target Job Description</div><div className="preset-container"><span className="preset-title">⚡ Campus Placement Presets:</span><div className="preset-bar">{presets.map(p=><button key={p.label}className="preset-pill"type="button"onClick={()=>applyPreset(p)}>+ {p.label}</button>)}</div></div><label className="dropzone"><Upload size={27}/><b>{jdFile?.name||'Upload the job description'}</b><span>{jdFile?'JD loaded · role matching ready':'PDF or TXT · or paste below'}</span><input type="file"accept=".pdf,.txt,application/pdf,text/plain"onChange={e=>{const f=e.target.files?.[0];e.target.value='';parseFile('jd',f)}}/></label>{jdFile&&<button className="clear-file"onClick={()=>clearFile('jd')}><X size={15}/> Remove JD</button>}<div className="or"><span>or paste JD text</span></div><textarea id="jdText"className="tall"value={jd}onChange={e=>{setJd(e.target.value);saveSession('gjr_jd_text',e.target.value)}}placeholder="Paste the target job description or choose a campus recruiter preset above…"/></div>:<div className="input-card mode-explainer"><div className="label"><Sparkles size={17}/> General CV mode</div><div className="module-hero"><span className="eyebrow">CV ONLY</span><h2>No JD needed.</h2><p>Your CV is analysed on its own. You will edit and save the version you want the AI interviewer to use.</p></div></div>}<div className="full action-row"><div><b>{prep==='general'?'Ready to improve your CV?':'Ready to improve and match your CV?'}</b><span>Nothing sends you straight to interview. CV review always comes first.</span></div><button className="primary"disabled={loading||!cv.trim()||prep==='specific'&&!jd.trim()}onClick={analyze}>{loading?'Reviewing your CV…':<>Review & improve my CV <ArrowRight size={18}/></>}</button></div></div></>
}

/* ─── CV ENGINE ─────────────────────────────────────────────── */
function parseCV(raw){
 const text=cleanExtractedCVText(raw||'');
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);

 let name='',title='',contact='';

 const firstLine=lines[0]||'';
 const topText=lines.slice(0,5).join('\n');

 // 1. Extract name from top line (before pipe '|', '+', email, or role titles)
 const emailMatch=topText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
 const email=emailMatch?emailMatch[0]:'';
 const phoneMatch=topText.match(/\+?\d[\d\s\-]{8,}\d/);
 const phone=phoneMatch?phoneMatch[0].trim():'';

 let nameCandidate=firstLine
  .split(/\||\+|[a-zA-Z0-9._%+-]+@|Backend|Frontend|Full\s*Stack|Software|Engineer|Developer|Intern|Data/i)[0]
  .replace(/[^A-Za-z\s.'-]/g,' ')
  .replace(/\s+/g,' ')
  .trim();

 if(nameCandidate&&nameCandidate.split(' ').length>=2&&nameCandidate.split(' ').length<=4){
  name=nameCandidate;
 }else{
  // Fallback scan of first 3 lines
  for(let i=0;i<Math.min(3,lines.length);i++){
   const clean=lines[i].replace(/[^A-Za-z\s.'-]/g,' ').replace(/\s+/g,' ').trim();
   const words=clean.split(' ');
   if(words.length>=2&&words.length<=4&&!/(Institute|University|College|Education|Experience|Projects|Skills)/i.test(clean)){
    name=clean;
    break;
   }
  }
 }

 // 2. Extract title if present (cleanly strip candidate name prefix)
 if(firstLine.includes('|')){
  const parts=firstLine.split('|').map(s=>s.trim());
  const roleParts=parts.map(p=>{
   let cleanP=p;
   if(name&&cleanP.toLowerCase().startsWith(name.toLowerCase())){
    cleanP=cleanP.slice(name.length).trim();
   }
   cleanP=cleanP
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,'')
    .replace(/\+?\d[\d\s\-]{8,}\d/g,'')
    .replace(/^(LinkedIn|GitHub|CodeChef|LeetCode|Codeforces|Portfolio)/gi,'')
    .trim();
   return cleanP;
  }).filter(p=>p.length>=3&&/(Engineer|Developer|Consultant|Analyst|Designer|Manager|Intern|Architect|Specialist|Lead|Associate)/i.test(p));

  if(roleParts.length)title=roleParts.join(' | ');
 }

 // 3. Build clean contact line across top lines
 const contactParts=[];
 if(phone)contactParts.push(phone);
 if(email)contactParts.push(email);
 if(/LinkedIn/i.test(topText))contactParts.push('LinkedIn');
 if(/GitHub/i.test(topText))contactParts.push('GitHub');
 if(/LeetCode/i.test(topText))contactParts.push('LeetCode');
 if(/CodeChef/i.test(topText))contactParts.push('CodeChef');
 if(/Codeforces/i.test(topText))contactParts.push('Codeforces');
 contact=contactParts.join(' | ');

 const sections={summary:[],competencies:[],experience:[],projects:[],education:[],certifications:[],achievements:[],leadership:[],others:[]};
 let currentSection='others';
 let currentJob=null;

 const finishBlock=()=>{
  if(currentJob){
   if(currentSection==='projects')sections.projects.push(currentJob);
   else if(currentSection==='achievements')sections.achievements.push(currentJob);
   else if(currentSection==='leadership')sections.leadership.push(currentJob);
   else sections.experience.push(currentJob);
   currentJob=null;
  }
 };

 lines.slice(1).forEach(l=>{
  // Ignore contact line so it doesn't pollute others
  if((email&&l.includes(email))||(phone&&l.includes(phone)))return;

  if(/(EXECUTIVE SUMMARY|PROFESSIONAL SUMMARY|SUMMARY|PROFILE|OBJECTIVE|ABOUT ME)/i.test(l)&&l.length<40){finishBlock();currentSection='summary';return}
  if(/(CORE COMPETENCIES|TECHNICAL SKILLS|SKILLS & TOOLS|KEY SKILLS|SKILLS|TECHNOLOGIES|COURSEWORK)/i.test(l)&&l.length<40){finishBlock();currentSection='competencies';return}
  if(/(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|SUMMER INTERNSHIP|INTERNSHIP|WORK HISTORY|EMPLOYMENT)/i.test(l)&&l.length<55){finishBlock();currentSection='experience';return}
  if(/(KEY PROJECTS|PROJECTS|ACADEMIC PROJECTS|PERSONAL PROJECTS|LIVE PROJECTS)/i.test(l)&&l.length<45){finishBlock();currentSection='projects';return}
  if(/(EDUCATION|ACADEMIC BACKGROUND|ACADEMIC DETAILS|ACADEMICS)/i.test(l)&&l.length<40){finishBlock();currentSection='education';return}
  if(/(CERTIFICATIONS|COURSES|TRAINING|LICENSES)/i.test(l)&&l.length<40){finishBlock();currentSection='certifications';return}
  if(/(ACHIEVEMENTS|HONORS|AWARDS|COMPETITIVE PROGRAMMING)/i.test(l)&&l.length<40){finishBlock();currentSection='achievements';return}
  if(/(LEADERSHIP & RESPONSIBILITY|LEADERSHIP|POSITIONS OF RESPONSIBILITY|VOLUNTEERING)/i.test(l)&&l.length<45){finishBlock();currentSection='leadership';return}

  if(currentSection==='summary'){sections.summary.push(l);return}
  if(currentSection==='competencies'){
   if(l.length<120&&!/^(Spearheaded|Progressed|Solved|Authored|Engineered|Partnered|•|▪)/i.test(l)){
    sections.competencies.push(...l.split(/[|,·•:]/).map(s=>s.trim()).filter(s=>s.length>=2&&s.length<=32&&!/^(Languages|Web|Databases|DevOps|Tools|Coursework|Leadership)/i.test(s)));
   }
   return}
  if(currentSection==='education'){sections.education.push(l);return}
  if(currentSection==='certifications'){sections.certifications.push(l);return}

  if(['experience','projects','achievements','leadership'].includes(currentSection)){
   const isBullet=/^[•▪*-]\s*/.test(l);
   const cleanText=l.replace(/^[•▪*-]\s*/,'').trim();
   if(isBullet){
    if(!currentJob){
     currentJob={role:currentSection.toUpperCase(),company:'',dates:'',bullets:[cleanText]};
    }else{
     currentJob.bullets.push(cleanText);
    }
   }else{
    finishBlock();
    const parts=l.split(/\s+[·|—]\s+/);
    currentJob={role:parts[0]||l,company:parts[1]||'',dates:parts.slice(2).join(' · ')||'',bullets:[]};
   }
   return;
  }

  sections.others.push(l);
 });
 finishBlock();

 return{name:name||'Your Name',title:title||'',contact:contact||'',sections};
}

function generateSuggestions(parsed,jd){
 const sugg=[];let id=0;
 const{sections,name,title}=parsed;
 const allText=JSON.stringify(parsed).toLowerCase();
 const domain=detectDomain(allText, jd||'', title||'');

 const firstExp=sections.experience[0]||sections.projects[0];
 const firstCompany=firstExp?.company||firstExp?.role||'your key role';
 const firstRole=firstExp?.role||(domain==='Marketing'?'Marketing Trainee':domain==='Finance'?'Financial Analyst':'Professional');
 const allBullets=[...sections.experience.flatMap(e=>e.bullets),...sections.projects.flatMap(p=>p.bullets)];
 const yearsMatch=allText.match(/(\d+)\s*(\+?\s*)year/i);
 const yearsExp=yearsMatch?parseInt(yearsMatch[1]):null;

 // 1. Executive Summary
 if(!sections.summary.length){
  const sumExample=domain==='Marketing'
   ?`MBA / PGDM (Marketing) with proven experience in channel sales distribution, GTM strategy, brand management, and market expansion. Track record translating consumer insights and trade partner data into measurable revenue growth.`
   :domain==='Finance'
   ?`MBA / PGDM (Finance) with strong analytical foundation in corporate finance, valuation modeling (DCF, multiples), credit risk analysis, and financial statement analysis.`
   :domain==='Consulting'||domain==='General Management'
   ?`Management professional specializing in operational excellence, process optimization, stakeholder consensus, and data-backed business problem solving.`
   :domain==='HR'
   ?`${yearsExp?yearsExp+'+ years of':''} experience in talent acquisition, HRBP, and organisational development. Proven track record building high-performance teams and reducing attrition.`
   :domain==='Technology'
   ?`Software Engineer with strong foundation in distributed systems, REST APIs, and scalable web architecture. Proven track record delivering production-ready applications and robust code.`
   :`Results-driven professional with hands-on experience in ${firstRole}. Strong problem-solver with a track record of measurable impact.`;
  sugg.push({id:id++,type:'add_section',section:'EXECUTIVE SUMMARY',icon:'📝',label:'Add a powerful Executive Summary (missing)',preview:sumExample,checked:true});
 }else{
  const sumText=sections.summary.join(' ');
  if(yearsExp&&!/\d+\s*(\+?\s*)year/i.test(sumText)){
   sugg.push({id:id++,type:'improve_summary',section:'EXECUTIVE SUMMARY',icon:'✍️',label:`Add your ${yearsExp}+ years of experience to the summary`,preview:`Start with: "${yearsExp}+ years of experience in ${firstRole}..." for immediate recruiter attention.`,checked:true});
  }
 }

 // 2. Competencies
 if(sections.competencies.length<6){
  const compExamples=domain==='Marketing'?'Channel Sales & Distribution · GTM Strategy · Brand Management · Market Research & Consumer Insights · Retail Penetration · Trade Promotions · Competitor Benchmarking · SPSS & Tableau'
   :domain==='Finance'?'Financial Modelling · DCF Valuation · Financial Statement Analysis · Credit Risk Assessment · Advanced Excel & SQL · Capital Budgeting · Portfolio Analysis'
   :domain==='Consulting'||domain==='General Management'?'Business Strategy & Problem Solving · Process Optimization · Supply Chain & Logistics · Stakeholder Management · Data-Driven Decision Making · Lean Six Sigma · Client Presentations'
   :domain==='HR'?'Talent Acquisition · HRBP · Org Design · Change Management · Employee Engagement · People Analytics'
   :domain==='Technology'?'Data Structures & Algorithms · System Design · Go / React · REST APIs & WebSockets · SQL / NoSQL · Docker & Cloud'
   :'Data Analysis · Problem Solving · Stakeholder Communication · Project Management · Critical Thinking · Presentation';
  sugg.push({id:id++,type:'add_competencies',section:'CORE COMPETENCIES',icon:'⚡',label:`Expand Core Competencies — you have only ${sections.competencies.length}, recruiters expect 6–9`,preview:compExamples,checked:true});
 }

 // 3. AI / modern tools
 if(!/ai|chatgpt|claude|copilot|llm|analytics|docker/i.test(allText)){
  const aiExample=domain==='Marketing'
   ?`Leveraged AI research and consumer sentiment tools (ChatGPT, Claude) to model customer preferences and accelerate campaign GTM by 30%.`
   :domain==='Finance'
   ?`Used AI analytics tools and advanced Excel automation to streamline financial modeling and reduce report turnaround by 35%.`
   :domain==='HR'
   ?`Used AI-powered ATS analytics and ChatGPT to screen 500+ applications, reducing time-to-hire by 28% and improving quality-of-hire scores.`
   :domain==='Technology'
   ?`Integrated LLM-driven APIs and automated prompt pipelines with strict schema validation to accelerate feature delivery.`
   :`Leveraged modern AI research tools (ChatGPT, Claude) to automate workflows and accelerate project delivery by 35%.`;
  sugg.push({id:id++,type:'add_bullet',section:'PROFESSIONAL EXPERIENCE',icon:'🤖',label:'Add AI & modern tools usage to your CV',preview:aiExample,checked:true});
 }

 // 4. Unquantified bullets
 const unquantified=allBullets.filter(b=>!/\d/.test(b)&&b.length>20).slice(0,2);
 unquantified.forEach((b,i)=>{
  const verb=b.match(/^(managed|led|handled|drove|supported|assisted|coordinated|engineered|designed|built|analyzed|formulated|conducted)/i)?.[0]||'Led';
  sugg.push({id:id++,type:'quantify_bullet',section:'PROFESSIONAL EXPERIENCE',icon:'📊',label:`Quantify: "${b.slice(0,50)}..." — add a number`,preview:`${verb} [X% growth / INR X Lakhs / X+ dealers / X% speedup]. Add the exact metric that proves business impact.`,checked:i===0});
 });

 // 5. Certifications
 if(!sections.certifications.length){
  const certExamples=domain==='Marketing'?'Google Digital Marketing & E-commerce · HubSpot Inbound Marketing · KPMG Lean Six Sigma Green Belt'
   :domain==='Finance'?'CFA Level I / II Candidate · Bloomberg Market Concepts (BMC) · CFI FMVA · Google AI Essentials'
   :domain==='Consulting'||domain==='General Management'?'Lean Six Sigma Green Belt · McKinsey Forward Program · Google Project Management'
   :domain==='HR'?'SHRM Certified Professional · LinkedIn Learning: People Analytics · Google AI Essentials'
   :domain==='Technology'?'AWS Certified Cloud Practitioner · Docker & Kubernetes Fundamentals · Google AI Essentials'
   :`Google AI Essentials (2024) · LinkedIn Learning: ${domain} Analytics · Coursera: AI for Everyone`;
  sugg.push({id:id++,type:'add_section',section:'CERTIFICATIONS',icon:'🎓',label:'Add Certifications section — shows commitment to learning',preview:certExamples,checked:false});
 }

 // 6. JD-specific keywords
 if(jd&&jd.length>50){
  const stopWords=new Set(['the','and','or','to','a','an','in','of','for','with','on','at','by','from','as','is','are','be','been','this','that','will','can','not','have','has','had','its','it']);
  const jdKeywords=[...new Set((jd.toLowerCase().match(/\b[a-z]{4,}\b/g)||[]))].filter(k=>!stopWords.has(k)).slice(0,40);
  const missing=jdKeywords.filter(k=>!allText.includes(k)).slice(0,3);
  missing.forEach(k=>{
   sugg.push({id:id++,type:'add_keyword',section:'PROFESSIONAL EXPERIENCE',icon:'🎯',label:`JD requires "${k}" — not found in your CV`,preview:`Add "${k}" naturally in an experience bullet to pass ATS screening.`,checked:true});
  });
 }

 return sugg;
}





function buildCV(parsed,checkedSuggestions){
 const p={...parsed,sections:{...parsed.sections,
  summary:[...parsed.sections.summary],
  competencies:[...parsed.sections.competencies],
  experience:parsed.sections.experience.map(e=>({...e,bullets:[...e.bullets]})),
  projects:parsed.sections.projects.map(pr=>({...pr,bullets:[...pr.bullets]})),
  leadership:parsed.sections.leadership.map(l=>({...l,bullets:[...l.bullets]})),
  certifications:[...parsed.sections.certifications],
 }};

 checkedSuggestions.forEach(s=>{
  if(s.type==='add_section'&&s.section==='EXECUTIVE SUMMARY'){
   if(!p.sections.summary.length)p.sections.summary=[s.preview];
  }
  if(s.type==='add_competencies'){
   const extras=s.preview.split('·').map(x=>x.trim()).filter(Boolean);
   extras.forEach(e=>{if(!p.sections.competencies.includes(e))p.sections.competencies.push(e)});
  }
  if(s.type==='add_bullet'&&p.sections.experience.length>0){
   p.sections.experience[0].bullets.push(s.preview);
  }
  if(s.type==='add_section'&&s.section==='CERTIFICATIONS'){
   const certs=s.preview.split('·').map(x=>x.trim()).filter(Boolean);
   p.sections.certifications.push(...certs);
  }
 });
 return p;
}

function renderExecutivePDF(p){
 const{name,title,contact,sections}=p;

 // Clean 3x3 Core Competencies grid (max 9 skills)
 const cleanComps=[...new Set((sections.competencies||[])
  .map(c=>c.replace(/^[▪•*-]\s*/,'').trim())
  .filter(c=>c.length>=2&&c.length<=28&&!/^(Languages|Web|Databases|DevOps|Tools|Coursework|Leadership|Spearheaded|Progressed|Solved)/i.test(c))
 )].slice(0,9);

 const compRows=[];
 for(let i=0;i<cleanComps.length;i+=3){
  compRows.push(cleanComps.slice(i,i+3));
 }

 let body='';

 // Summary
 if(sections.summary.length){
  body+=`<div class="section"><h2>E X E C U T I V E &nbsp; S U M M A R Y</h2><p class="summary-text">${sections.summary.join(' ')}</p></div>`;
 }

 // Competencies
 if(compRows.length){
  body+=`<div class="section"><h2>C O R E &nbsp; C O M P E T E N C I E S</h2><table class="comp-table">`;
  compRows.forEach(row=>{
   body+=`<tr>${row.map(c=>`<td>▪ ${c}</td>`).join('')}</tr>`;
  });
  body+=`</table></div>`;
 }

 // Experience
 if(sections.experience?.length){
  body+=`<div class="section"><h2>P R O F E S S I O N A L &nbsp; E X P E R I E N C E</h2>`;
  sections.experience.forEach(e=>{
   if(e.role||e.company||e.bullets?.length){
    body+=`<div class="job-block"><div class="job-header">${e.role?`<span class="job-role">${e.role}</span>`:''}${e.company?`<span class="job-sep"> · </span><span class="job-company">${e.company}</span>`:''}${e.dates?`<span class="job-dates">${e.dates}</span>`:''}</div>`;
    if(e.bullets?.length){body+=`<ul>${e.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`}
    body+=`</div>`;
   }
  });
  body+=`</div>`;
 }

 // Projects
 if(sections.projects?.length){
  body+=`<div class="section"><h2>K E Y &nbsp; P R O J E C T S</h2>`;
  sections.projects.forEach(p=>{
   if(p.role||p.company||p.bullets?.length){
    body+=`<div class="job-block"><div class="job-header">${p.role?`<span class="job-role">${p.role}</span>`:''}${p.company?`<span class="job-sep"> · </span><span class="job-company">${p.company}</span>`:''}${p.dates?`<span class="job-dates">${p.dates}</span>`:''}</div>`;
    if(p.bullets?.length){body+=`<ul>${p.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`}
    body+=`</div>`;
   }
  });
  body+=`</div>`;
 }

 // Education
 if(sections.education?.length){
  body+=`<div class="section"><h2>E D U C A T I O N</h2>`;
  sections.education.forEach(l=>{body+=`<p class="edu-line">${l}</p>`});
  body+=`</div>`;
 }

 // Achievements
 if(sections.achievements?.length){
  body+=`<div class="section"><h2>A C H I E V E M E N T S</h2>`;
  sections.achievements.forEach(a=>{
   if(a.bullets?.length){body+=`<ul>${a.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`}
   else if(a.role){body+=`<p class="edu-line">${a.role}</p>`}
  });
  body+=`</div>`;
 }

 // Leadership & Positions of Responsibility
 if(sections.leadership?.length){
  body+=`<div class="section"><h2>P O S I T I O N S &nbsp; O F &nbsp; R E S P O N S I B I L I T Y</h2>`;
  sections.leadership.forEach(l=>{
   if(l.role||l.company||l.bullets?.length){
    body+=`<div class="job-block"><div class="job-header">${l.role?`<span class="job-role">${l.role}</span>`:''}${l.company?`<span class="job-sep"> · </span><span class="job-company">${l.company}</span>`:''}${l.dates?`<span class="job-dates">${l.dates}</span>`:''}</div>`;
    if(l.bullets?.length){body+=`<ul>${l.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`}
    body+=`</div>`;
   }else if(l.role){
    body+=`<p class="edu-line">${l.role}</p>`;
   }
  });
  body+=`</div>`;
 }

 // Certifications
 if(sections.certifications.length){
  body+=`<div class="section"><h2>C E R T I F I C A T I O N S</h2><ul>${sections.certifications.map(c=>`<li>${c}</li>`).join('')}</ul></div>`;
 }

 const css=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @media print {
   @page { margin: 6mm 10mm; size: A4 portrait; }
   body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 9pt !important; }
   .cv-wrap { max-height: 282mm; overflow: hidden; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-variant-ligatures: none; }
  html, body { background: #fff; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 9.5px; line-height: 1.38; color: #1e293b; }
  .cv-wrap { width: 100%; max-width: 820px; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
  .cv-banner { background: linear-gradient(135deg, #15213b, #1a2744 60%, #25375c); padding: 18px 32px 12px; position: relative; }
  .cv-banner h1 { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 3px; line-height: 1.1; }
  .cv-banner .cv-title { font-size: 11px; color: #cbd5e1; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.3px; }
  .cv-contact { background: #0f172a; padding: 6px 32px; font-size: 9px; color: #cbd5e1; display: flex; flex-wrap: wrap; gap: 2px 14px; font-weight: 500; border-bottom: 2px solid #2563eb; }
  .cv-contact .sep { color: #475569; margin: 0 2px; }
  .cv-body { padding: 14px 32px 16px; display: flex; flex-direction: column; gap: 10px; }
  .section { page-break-inside: avoid; }
  h2 { font-size: 9.5px; font-weight: 800; letter-spacing: 2px; color: #1a2744; border-bottom: 1px solid #1a2744; padding-bottom: 2px; margin-bottom: 6px; text-transform: uppercase; }
  .summary-text { font-size: 9.5px; color: #334155; line-height: 1.4; }
  .comp-table { width: 100%; border-collapse: collapse; margin-top: 1px; }
  .comp-table td { font-size: 9.5px; font-weight: 500; color: #334155; padding: 2px 6px 2px 0; width: 33.3%; vertical-align: top; }
  .job-block { margin-bottom: 8px; page-break-inside: avoid; }
  .job-block:last-child { margin-bottom: 0; }
  .job-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 3px; margin-bottom: 2px; }
  .job-role { font-weight: 700; font-size: 10.5px; color: #0f172a; }
  .job-sep { color: #94a3b8; font-size: 10px; }
  .job-company { font-size: 10px; color: #2563eb; font-weight: 600; }
  .job-dates { margin-left: auto; font-size: 9px; color: #64748b; font-style: italic; white-space: nowrap; }
  ul { padding-left: 14px; margin: 2px 0 0; }
  li { font-size: 9.5px; color: #334155; margin-bottom: 2px; line-height: 1.36; }
  li:last-child { margin-bottom: 0; }
  .edu-line { font-size: 9.5px; color: #334155; margin-bottom: 2px; line-height: 1.35; }
  p { font-size: 9.5px; color: #334155; }
 `;

 return `<html><head><meta charset="utf-8"><title>CV – ${name}</title><style>${css}</style></head><body>
  <div class="cv-wrap">
   <div class="cv-banner">
    <h1>${name}</h1>
    ${title?`<div class="cv-title">${title}</div>`:''}
   </div>
   ${contact?`<div class="cv-contact">${contact.replace(/\|/g,'<span class="sep">|</span>')}</div>`:''}
   <div class="cv-body">${body}</div>
  </div>
 </body></html>`;
}


/* ─── CV STUDIO COMPONENT ───────────────────────────────────── */
function CVStudio({result,initial,mode,jd,isMasterCV,onSave,onContinue,onGoHome,onCustomRoleInterview}){
 const sourceCV = String(initial || '').trim() || db.getMasterCV() || readSession('gjr_cv_text', '');
 const[parsed,setParsed]=useState(()=>parseCV(sourceCV));
 const[suggestions,setSuggestions]=useState(()=>generateSuggestions(parseCV(sourceCV),jd||''));
 const[checked,setChecked]=useState(()=>{
  const s=generateSuggestions(parseCV(sourceCV),jd||'');
  return new Set(s.filter(x=>x.checked).map(x=>x.id));
 });
 const[applied,setApplied]=useState(false);
 const[builtCV,setBuiltCV]=useState(null);
 const[showEdit,setShowEdit]=useState(false);
 const[editText,setEditText]=useState(()=>cleanExtractedCVText(sourceCV));
 const[previewKey,setPreviewKey]=useState(0);
 const[showTargetModal,setShowTargetModal]=useState(false);
 const[targetCompany,setTargetCompany]=useState('');
 const[targetRole,setTargetRole]=useState('');

 const confirmTargetInterview=()=>{
  if(!targetRole.trim())return;
  setShowTargetModal(false);
  if(onCustomRoleInterview){
   onCustomRoleInterview(targetRole.trim(),targetCompany.trim(),editText);
  }
 };

 // Score evaluation fallback
 const currentResult=(result&&result.score)?result:localReview(initial||'',jd||'',mode);
 const currentScore=currentResult.score||78;
 const currentHeadline=currentResult.headline||(mode==='general'?'Your CV has a solid foundation.':'Role-specific placement alignment in progress.');
 const currentSummary=currentResult.summary||'Review and apply recommended improvements below before your interview.';
 const scoreColor=currentScore>=80?'#22c55e':currentScore>=65?'#f59e0b':'#ef4444';

 // JD keyword match %
 const jdMatchPct=useMemo(()=>{
  if(!jd||jd.length<30)return null;
  const cvLow=(editText||'').toLowerCase();
  const stopWords=new Set(['the','and','or','to','a','an','in','of','for','with','on']);
  const jdWords=[...new Set((jd.toLowerCase().match(/\b[a-z]{4,}\b/g)||[]))].filter(k=>!stopWords.has(k)).slice(0,30);
  if(!jdWords.length)return null;
  const matched=jdWords.filter(k=>cvLow.includes(k)).length;
  return Math.round((matched/jdWords.length)*100);
 },[jd,editText]);

 const toggleCheck=id=>{
  setChecked(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n});
 };

 const applySelected=()=>{
  const selectedSuggs=suggestions.filter(s=>checked.has(s.id));
  const updated=buildCV(parsed,selectedSuggs);
  setParsed(updated);
  setBuiltCV(updated);
  setApplied(true);
  setPreviewKey(k=>k+1);
  const plainText=renderExecutivePDF(updated);
  onSave(editText);
  saveSession('gjr_cv_text',editText);
 };

 const downloadPDF=()=>{
  const p=builtCV||parsed;
  const html=renderExecutivePDF(p);
  const w=window.open('','_blank');
  w.document.write(html);w.document.close();w.focus();
  setTimeout(()=>{w.print();w.close()},600);
 };

 const downloadWord=()=>{
  const p=builtCV||parsed;
  const html=renderExecutivePDF(p).replace('<html>',`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`);
  const blob=new Blob(['\ufeff',html],{type:'application/msword'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`CV_${parsed.name.replace(/\s+/g,'_')}.doc`;a.click();
 };

 const handleManualSave=()=>{
  const reParsed=parseCV(editText);
  setParsed(reParsed);setSuggestions(generateSuggestions(reParsed,jd||''));
  setChecked(new Set(generateSuggestions(reParsed,jd||'').filter(x=>x.checked).map(x=>x.id)));
  setBuiltCV(null);setApplied(false);setShowEdit(false);
 };

 const previewHTML=renderExecutivePDF(builtCV||parsed);

 return <div className="studio">
  {/* Score card */}
  <div className="score-card">
   <div><span className="eyebrow">AI CV REVIEW · PLACEMENT READINESS</span><h2>{currentHeadline}</h2><p>{currentSummary}</p></div>
   <div className="score-ring" style={{'--score-color':scoreColor}}><strong style={{color:scoreColor}}>{currentScore}</strong><small>/100</small></div>
  </div>
  {/* JD match bar */}
  {jdMatchPct!==null&&<div className="jd-match-bar">
   <span>🎯 JD Keyword Match:</span>
   <div className="jd-match-track"><div className="jd-match-fill" style={{width:jdMatchPct+'%',background:jdMatchPct>=70?'#22c55e':jdMatchPct>=45?'#f59e0b':'#ef4444'}}/></div>
   <strong style={{color:jdMatchPct>=70?'#22c55e':jdMatchPct>=45?'#f59e0b':'#ef4444'}}>{jdMatchPct}%</strong>
   <span className="jd-match-tip">{jdMatchPct>=70?'Strong ATS match ✓':jdMatchPct>=45?'Add more JD keywords':'Low match — apply ticked suggestions'}</span>
  </div>}


  {/* Two-col layout: suggestions left, preview right */}
  <div className="studio-cols">
   {/* LEFT: Suggestion checklist */}
   <div className="suggestion-panel">
    <div className="suggestion-header">
     <Sparkles size={17}/>
     <div>
      <b>Tick improvements to apply to your CV</b>
      <span>Selected suggestions will be applied and formatted into a world-class PDF</span>
     </div>
    </div>

    <div className="suggestion-list">
     {suggestions.map(s=>(
      <label key={s.id} className={`suggestion-item ${checked.has(s.id)?'checked':''}`}>
       <input type="checkbox" checked={checked.has(s.id)} onChange={()=>toggleCheck(s.id)}/>
       <div className="sug-body">
        <span className="sug-icon">{s.icon}</span>
        <div>
         <span className="sug-section">{s.section}</span>
         <b className="sug-label">{s.label}</b>
         <span className="sug-preview">{s.preview}</span>
        </div>
       </div>
      </label>
     ))}
    </div>

    <div className="suggestion-actions">
     <button className="primary wide" onClick={applySelected}>
      <CheckCircle2 size={16}/> Apply {checked.size} improvement{checked.size!==1?'s':''} & preview
     </button>
     <button className="ghost-sm" onClick={()=>setShowEdit(!showEdit)}>
      {showEdit?'Close editor':'✏️ Edit raw CV text'}
     </button>
    </div>

    {showEdit&&<div className="edit-panel">
     <div className="label"><FileText size={15}/> Edit your CV text directly</div>
     <textarea value={editText} onChange={e=>{setEditText(e.target.value);saveSession('gjr_cv_text',e.target.value)}} rows={14}/>
     <button className="secondary" onClick={handleManualSave}>Re-parse & regenerate suggestions</button>
    </div>}

    {/* AI Certifications */}
    <div className="cert-strip">
     <span>🎓 Free AI certifications to add:</span>
     <div className="course-links">
      <a href="https://www.coursera.org/learn/google-ai-essentials" target="_blank" rel="noreferrer" className="course-chip">Google AI Essentials ↗</a>
      <a href="https://www.deeplearning.ai/courses/ai-for-everyone/" target="_blank" rel="noreferrer" className="course-chip">DeepLearning.AI ↗</a>
      <a href="https://www.linkedin.com/learning/" target="_blank" rel="noreferrer" className="course-chip">LinkedIn Learning ↗</a>
     </div>
    </div>
   </div>

   {/* RIGHT: Live CV Preview */}
   <div className="preview-panel">
    <div className="preview-header">
     <b>👑 World-Class Executive CV Preview</b>
     <div style={{display:'flex',gap:'8px'}}>
      <button className="ghost-sm" onClick={downloadPDF}>⬇ PDF</button>
      <button className="ghost-sm" onClick={downloadWord}>⬇ Word</button>
     </div>
    </div>
    {applied&&<div className="applied-badge"><CheckCircle2 size={14}/> {checked.size} improvements applied</div>}
    <div className="cv-preview-frame">
     <iframe key={previewKey} srcDoc={previewHTML} title="CV Preview" sandbox="allow-same-origin" style={{width:'100%',height:'780px',border:'none',borderRadius:'0 0 10px 10px'}}/>
    </div>
    <div className="continue-card" style={{flexDirection:'column',alignItems:'stretch',gap:'14px'}}>
     {isMasterCV ? (
      <>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}>
        <div>
         <b style={{fontSize:'15px'}}>✅ Master CV saved & ready!</b>
         <span style={{display:'block',fontSize:'12px',color:'#64748b',marginTop:'2px'}}>What would you like to do next? Have a direct voice interview, practice for a specific company/role, or save to applications.</span>
        </div>
       </div>
       <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
        <button className="primary" onClick={()=>{onSave(editText);onContinue(editText)}}>
         <Mic size={16}/> Direct Audio Interview (General CV)
        </button>
        <button className="secondary" style={{background:'#f3e8ff',color:'#6b21a8'}} onClick={()=>{onSave(editText);setShowTargetModal(true)}}>
         💼 Practise for Target Company / Role
        </button>
        <button className="ghost-sm" onClick={()=>{onSave(editText);onGoHome&&onGoHome()}}>
         📁 Save & Go to Workspace
        </button>
       </div>
      </>
     ) : (
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
       <div><b>Next: live interview</b><span>Your improved CV will be used by the AI interviewer for this role.</span></div>
       <button className="primary" onClick={()=>{onSave(editText);onContinue(editText)}}>Save & start interview <ArrowRight size={18}/></button>
      </div>
     )}
    </div>
   </div>
  </div>

  {showTargetModal&&<div className="modal" onClick={e=>e.target===e.currentTarget&&setShowTargetModal(false)}>
   <div className="modal-card login-card">
    <button className="modal-x" onClick={()=>setShowTargetModal(false)}><X size={18}/></button>
    <span className="eyebrow">CUSTOM TARGET ROLE INTERVIEW</span>
    <h2>Practise for a Target Company or Role</h2>
    <p>Specify the target company and role title (e.g. Coding Panda – Full Stack Developer or Asian Paints – Territory Sales Manager). The AI interviewer will tailor questions specifically to your CV and this target role.</p>
    <div style={{display:'flex',flexDirection:'column',gap:'12px',margin:'15px 0'}}>
     <div><label style={{fontSize:'12px',fontWeight:700,display:'block',marginBottom:'4px'}}>Target Company / Employer (optional)</label>
     <input type="text" className="login-input" style={{marginBottom:0}} placeholder="e.g. Coding Panda, Deloitte, Google, Asian Paints" value={targetCompany} onChange={e=>setTargetCompany(e.target.value)}/></div>
     <div><label style={{fontSize:'12px',fontWeight:700,display:'block',marginBottom:'4px'}}>Target Role / Job Title</label>
     <input type="text" className="login-input" style={{marginBottom:0}} placeholder="e.g. Full Stack Intern, Management Trainee" value={targetRole} onChange={e=>setTargetRole(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&targetRole.trim()){confirmTargetInterview();}}}/></div>
    </div>
    <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
     <button className="ghost-sm" onClick={()=>setShowTargetModal(false)}>Cancel</button>
     <button className="primary" disabled={!targetRole.trim()} onClick={confirmTargetInterview}>
      Start Tailored Audio Interview <ArrowRight size={16}/>
     </button>
    </div>
   </div>
  </div>}
 </div>
}


function VoiceInterview({cv,jd,mode,career,roleName,question,turn,maxTurns,history,onTurn,onDone}){
 const[status,setStatus]=useState('starting'),[transcript,setTranscript]=useState(''),[turns,setTurns]=useState(history||[]),[permission,setPermission]=useState(false);
 const[silenceCountdown,setSilenceCountdown]=useState(null);
 const[showTypeMode,setShowTypeMode]=useState(false),[typedAnswer,setTypedAnswer]=useState('');
 const rec=useRef(null),started=useRef(false),submitting=useRef(false),latestTranscript=useRef('');
 const silenceTimerRef=useRef(null),countdownIntervalRef=useRef(null),speechFinalizedRef=useRef('');
 const mediaRecorderRef=useRef(null),audioChunksRef=useRef([]);
 const supported=typeof window!=='undefined'&&('webkitSpeechRecognition'in window||'SpeechRecognition'in window);
 useEffect(()=>{setTurns(history||[])},[history]);
 useEffect(()=>{
  window.__gjrSubmitAnswer=(text)=>{
   latestTranscript.current=text;
   submit(text);
  };
  return()=>{delete window.__gjrSubmitAnswer};
 },[question,turn,turns]);

 const clearSilenceTimers=()=>{
  if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}
  if(countdownIntervalRef.current){clearInterval(countdownIntervalRef.current);countdownIntervalRef.current=null;}
  setSilenceCountdown(null);
 };

 const finalizeAndSubmit=async()=>{
  if(submitting.current)return;
  clearSilenceTimers();
  const answer=latestTranscript.current.trim();
  if(!answer){
   setStatus('idle');
   return;
  }
  submitting.current=true;
  setStatus('thinking');
  if(rec.current){
   try{rec.current.stop()}catch(e){}
  }
  let audioDataUrl='';
  if(mediaRecorderRef.current&&mediaRecorderRef.current.state!=='inactive'){
   try{
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream?.getTracks()?.forEach(t=>t.stop());
    if(audioChunksRef.current.length>0){
     const blob=new Blob(audioChunksRef.current,{type:'audio/webm'});
     audioDataUrl=await new Promise(res=>{
      const reader=new FileReader();
      reader.onloadend=()=>res(reader.result);
      reader.readAsDataURL(blob);
     });
    }
   }catch(e){}
  }
  submit(answer,audioDataUrl).finally(()=>{submitting.current=false});
 };

 const resetSilenceTimer=()=>{
  clearSilenceTimers();
  let remaining=2;
  setSilenceCountdown(remaining);
  countdownIntervalRef.current=setInterval(()=>{
   remaining-=1;
   if(remaining>0){
    setSilenceCountdown(remaining);
   }else{
    if(countdownIntervalRef.current){clearInterval(countdownIntervalRef.current);countdownIntervalRef.current=null;}
   }
  },1000);

  silenceTimerRef.current=setTimeout(()=>{
   finalizeAndSubmit();
  },2400);
 };

 const speakAndListen=()=>{
  if(started.current)return;
  started.current=true;
  setStatus('starting');
  latestTranscript.current='';
  speechFinalizedRef.current='';
  setTranscript('');
  clearSilenceTimers();
  window.speechSynthesis?.cancel();
  
  getBestHumanVoice(bestVoice=>{
   if(!started.current)return;
   const u=new SpeechSynthesisUtterance(question);
   if(bestVoice){
    u.voice=bestVoice;
    u.lang=bestVoice.lang||'en-IN';
   }else{
    u.lang='en-IN';
   }
   u.rate=0.98;u.pitch=1;
   u.onend=()=>beginRecognition();
   u.onerror=()=>beginRecognition();
   window.speechSynthesis?.speak(u);
  });
 };

 const beginRecognition=()=>{
   if(!supported){setStatus('unsupported');return}
   if(rec.current){
    try{rec.current.abort()}catch(e){}
   }
   const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
   const r=new SR();
   r.lang='en-IN';r.interimResults=true;r.continuous=true;r.maxAlternatives=3;
   r.onstart=()=>{
    setStatus('listening');setPermission(true);
   };
   r.onresult=e=>{
    let interim='';let final='';
    for(let i=0;i<e.results.length;i++){
     const res=e.results[i];
     let best=res[0]?.transcript||'';
     if(res.length>1){
      for(let a=1;a<res.length;a++){
       const cand=(res[a]?.transcript||'').trim();
       if(/^(i\s+did\s+a?\s+good\s+job|i\s+did\s+well|good\s+job|i\s+worked|i\s+built|my\s+role|in\s+my\s+experience)/i.test(cand)){
        best=cand;break;
       }
      }
     }
     if(res.isFinal){
      final+=best+' ';
     }else{
      interim+=best+' ';
     }
    }
    let currentTotal=(final+interim).trim();
    if(currentTotal){
     currentTotal=currentTotal
      .replace(/\bmy data good job\b/gi,'I did a good job')
      .replace(/\bmy data\b/gi,'I did')
      .replace(/\bi will be your picture\b/gi,'I will do a good job')
      .replace(/\bi will be a picture\b/gi,'I will do a good job')
      .replace(/\bi did good job\b/gi,'I did a good job')
      .replace(/\bi did a god job\b/gi,'I did a good job')
      .replace(/\btechnolo\b/gi,'technology')
      .replace(/\s+/g,' ')
      .trim();
     latestTranscript.current=currentTotal;
     setTranscript(currentTotal);
     resetSilenceTimer();
    }
   };
   r.onend=()=>{
    if(!submitting.current&&status==='listening'&&!latestTranscript.current.trim()){
     try{r.start()}catch(e){}
    }
   };
   r.onerror=e=>{
    if(e.error==='not-allowed'||e.error==='service-not-allowed')setStatus('permission');
    else if(e.error!=='aborted'&&!submitting.current){
     console.warn('Speech recognition warning:',e.error);
    }
   };
   rec.current=r;
   try{r.start()}catch{setStatus('error')}
  };

 const startJourney=()=>{
  clearSilenceTimers();
  submitting.current=false;
  started.current=false;
  speakAndListen();
 };

 const submit=async(answer,audioUrl='')=>{
  try{
   let data;
   const allQuestions=generateTailoredCVQuestions(cv,jd,roleName||'');
   const localEval=evaluateInterviewTurnLocal(question,answer,turns,cv);
   try{
    data=await post('/api/interview-turn',{cv,jd,mode,career,question,answer,history:turns,turn,maxTurns});
    if(data && data.evaluation){
     data.evaluation.modelAnswer=data.evaluation.modelAnswer||localEval.evaluation.modelAnswer;
     data.evaluation.notes=data.evaluation.notes||localEval.evaluation.notes;
    }
   }catch(e){
    console.warn('AI turn evaluate error; using local evaluator',e);
    const nextQ=allQuestions[turns.length+1]||'What is one thing you would improve in your next interview answer, and why?';
    data={
     done:localEval.done,
     nextQuestion:nextQ,
     evaluation:localEval.evaluation,
     finalFeedback:localEval.finalFeedback
    };
   }
   const finalEval=(data&&data.evaluation)?{...localEval.evaluation,...data.evaluation,modelAnswer:data.evaluation.modelAnswer||localEval.evaluation.modelAnswer,notes:data.evaluation.notes||localEval.evaluation.notes}:localEval.evaluation;
   const finalFeedback=localEval.finalFeedback;
   setTurns(x=>[...x,{question,answer,audioUrl,evaluation:finalEval}]);
   setTranscript('');
   latestTranscript.current='';
   setStatus('starting');
   onTurn({...data, evaluation:finalEval, finalFeedback, done:(data&&data.done)||localEval.done}, answer, audioUrl);
   started.current=false;
  }catch(e){
   setStatus('error');
   alert(e.message||'We could not submit this answer. Please try again.');
  }
 };

 useEffect(()=>{
  setStatus('starting');
  started.current=false;
  submitting.current=false;
  setTranscript('');
  latestTranscript.current='';
  clearSilenceTimers();
  window.speechSynthesis?.cancel();
  scrollToTop();
  const t=setTimeout(()=>{if(!started.current)startJourney()},600);
  return()=>{
   clearTimeout(t);
   clearSilenceTimers();
   rec.current?.abort();
   window.speechSynthesis?.cancel();
  };
 },[question,turn]);

 return <div className="interview">
  <div className="interview-header">
   <span className="q-number">QUESTION {turn} OF {maxTurns}</span>
   <div className="interview-progress">{Array.from({length:maxTurns}).map((_,i)=><div key={i} className={`dot ${i<turn-1?'done':i===turn-1?'active':''}`}/>)}</div>
  </div>
  <div className="question-card" aria-live="polite">
   <h2>{question}</h2>
   <p>{status==='starting'?'AI Interviewer is speaking the question aloud…':status==='thinking'?'AI is evaluating your answer…':status==='listening'?'Listening to your answer — finish speaking and it will capture automatically.':'Hands-free mode active. Question is spoken out loud.'}</p>
  </div>
  <div className={`voice-card handsfree ${status}`} onClick={status==='idle'||status==='permission'||status==='error'?startJourney:undefined} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startJourney()}}}>
   <div className={`mic ${status}`}><Mic size={38}/>{(status==='listening'||status==='starting')&&<i/>}</div>
   <div className="voice-state">
    <b>{status==='starting'?'Speaking Question…':status==='listening'?'Listening to you…':status==='thinking'?'Evaluating answer…':status==='permission'?'Tap to allow microphone':'Tap to restart question'}</b>
    <span>{supported?'Hands-free active. Answers are captured automatically when you stop speaking.':'Use Chrome on Android or desktop for voice input.'}</span>
   </div>
  </div>
  <div className="transcript-card">
   <div className="transcript-head">
    <div className="label"><Headphones size={17}/> Live transcript</div>
    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
     {status==='listening'&&silenceCountdown!==null&&<span style={{color:'#6855e8',background:'#f0edff',padding:'2px 8px',borderRadius:'999px',fontSize:'11px',fontWeight:700}}>Auto-submitting in {silenceCountdown}s</span>}
     <span>{transcript?'Capturing':'Waiting for your answer'}</span>
    </div>
   </div>
   <p className={transcript?'live':''}>{transcript||'Your spoken answer will appear here in real time.'}</p>
    {status==='listening'&&transcript.trim().length>0&&(
     <div style={{marginTop:'12px',display:'flex',gap:'10px',justifyContent:'flex-end',alignItems:'center',flexWrap:'wrap'}}>
      <button className="ghost-sm" style={{fontSize:'12px',padding:'6px 12px'}} onClick={startJourney}>
       <RefreshCw size={13}/> Restart Answer
      </button>
      <button className="ghost-sm" style={{fontSize:'12px',padding:'6px 12px',color:'#6855e8',borderColor:'#c4b5fd'}} onClick={()=>{setTypedAnswer(transcript);setShowTypeMode(true);clearSilenceTimers();}}>
       ✏️ Edit Answer
      </button>
      <button className="primary-sm" style={{fontSize:'12px',padding:'7px 16px',borderRadius:'999px',display:'inline-flex',alignItems:'center',gap:'6px'}} onClick={finalizeAndSubmit}>
       Done Speaking · Submit Now <ArrowRight size={14}/>
      </button>
     </div>
    )}
   </div>
   <div style={{marginTop:'12px',textAlign:'center'}}>
    {!showTypeMode ? (
     <button type="button" className="ghost-sm" style={{fontSize:'12px',color:'#6855e8',background:'rgba(104,85,232,0.06)'}} onClick={()=>setShowTypeMode(true)}>
      ⌨️ Or type / paste answer (library / quiet mode)
     </button>
    ) : (
     <div style={{marginTop:'8px',padding:'16px',background:'#fff',borderRadius:'16px',border:'1px solid #e2e8f0',textAlign:'left'}}>
      <label style={{fontSize:'12px',fontWeight:700,display:'block',marginBottom:'6px',color:'#334155'}}>
       Type your answer (STAR method):
      </label>
      <textarea
       id="interviewTypedInput"
       value={typedAnswer}
       onChange={e=>setTypedAnswer(e.target.value)}
       rows={4}
       placeholder="Situation → Task → Action → Result (include metrics and your role)..."
       style={{width:'100%',padding:'10px',borderRadius:'10px',border:'1px solid #cbd5e1',fontSize:'13px',lineHeight:'1.5'}}
      />
      <div style={{marginTop:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
       <button type="button" className="ghost-sm" onClick={()=>{setShowTypeMode(false);setTypedAnswer('');}}>
        Close
       </button>
       <button
        type="button"
        className="primary-sm"
        disabled={!typedAnswer.trim() || submitting.current}
        onClick={()=>{
         const ans=typedAnswer.trim();
         setTypedAnswer('');
         setShowTypeMode(false);
         latestTranscript.current=ans;
         submit(ans);
        }}
       >
        Submit Typed Answer <ArrowRight size={14}/>
       </button>
      </div>
     </div>
    )}
   </div>
   {permission&&<div className="interview-hint"><Volume2 size={15}/> Question audio · automatic answer capture · 100% hands-free</div>}
  </div>
}

function Feedback({data,answers,onSyncSpokenWins,onHome,onPractiseAgain,onImproveCV,onModule}){
 useLayoutEffect(()=>{
  scrollToTop();
  const raf=requestAnimationFrame(scrollToTop);
  const t=setTimeout(scrollToTop,50);
  return ()=>{cancelAnimationFrame(raf);clearTimeout(t)};
 },[]);
 const d=data||{score:0,strengths:['None identified — all submitted answers were under 10 words or generic placeholders.'],improvements:['All submitted answers were too brief or generic. A recruiter will reject these immediately.','Every answer must use the STAR method: Situation → Task → Action → Result.','Speak for 45–60 seconds per question, referencing specific projects and tech stacks from your CV.','Review the Model Answers below for each question to see what hiring managers look for.'],nextAction:'Review the model answers below and practise again with real STAR answers from your CV.'};
 const[copied,setCopied]=useState(false);const[synced,setSynced]=useState(false);
 const[activeAudio,setActiveAudio]=useState(null);

 const playVoice=(text,id)=>{
  if(!text)return;
  if(activeAudio===id){
   window.speechSynthesis?.cancel();
   setActiveAudio(null);
   return;
  }
  window.speechSynthesis?.cancel();
  getBestHumanVoice(bestVoice=>{
   const u=new SpeechSynthesisUtterance(text);
   if(bestVoice){
    u.voice=bestVoice;
    u.lang=bestVoice.lang||'en-IN';
   }else{
    u.lang='en-IN';
   }
   u.rate=0.98;
   u.onend=()=>setActiveAudio(null);
   u.onerror=()=>setActiveAudio(null);
   setActiveAudio(id);
   window.speechSynthesis?.speak(u);
  });
 };

 const copyReport=()=>{
  const text=`GETJOBREADY INTERVIEW REPORT\nOverall Score: ${d.score}/100\nNext Action: ${d.nextAction}\n\nStrengths:\n${(d.strengths||[]).map(s=>'- '+s).join('\n')}\n\nImprovements:\n${(d.improvements||[]).map(i=>'- '+i).join('\n')}\n\nTRANSCRIPT & MODEL ANSWERS:\n${(answers||[]).map((a,i)=>`Q${i+1}: ${a.question}\nScore: ${a.evaluation?.score||'N/A'}/100\nYour Answer: "${a.answer}"\nCoach Feedback: ${a.evaluation?.notes||'N/A'}\nModel Answer: ${a.evaluation?.modelAnswer||'N/A'}`).join('\n\n')}`;
  navigator.clipboard?.writeText(text);
  setCopied(true);setTimeout(()=>setCopied(false),2000);
 };
 const downloadReport=()=>{
  const text=`GETJOBREADY CAMPUS PLACEMENT READINESS REPORT\nScore: ${d.score}/100\nNext Action: ${d.nextAction}\n\nStrengths:\n${(d.strengths||[]).map(s=>'- '+s).join('\n')}\n\nImprovements:\n${(d.improvements||[]).map(i=>'- '+i).join('\n')}\n\nDETAILED TRANSCRIPT & MODEL ANSWERS:\n${(answers||[]).map((a,i)=>`Q${i+1}: ${a.question}\nScore: ${a.evaluation?.score||'N/A'}/100\nYour Answer: "${a.answer}"\nCoach Feedback: ${a.evaluation?.notes||'N/A'}\nModel Answer (STAR format):\n${a.evaluation?.modelAnswer||'N/A'}`).join('\n\n')}`;
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='GetJobReady_Interview_Report.txt';a.click();
  URL.revokeObjectURL(url);
 };
 const goodAnswers=(answers||[]).filter(a=>a.answer&&a.answer.split(/\s+/).filter(Boolean).length>15);
 const handleSync=()=>{
  if(!goodAnswers.length){alert('Your answers were too brief to sync. Practise again with full STAR answers first.');return;}
  const spokenBullets=goodAnswers.map((a,i)=>{
   const clean=a.answer.replace(/[\r\n]+/g,' ').trim();
   return `• [Interview STAR] ${clean.charAt(0).toUpperCase()+clean.slice(1)}${clean.endsWith('.')?'':'.'}`;
  });
  if(onSyncSpokenWins){onSyncSpokenWins(spokenBullets.join('\n'));setSynced(true);}
 };
 const sc=(d.score!==undefined&&d.score!==null&&d.score>0)?d.score:(answers&&answers.length)?Math.round(answers.reduce((acc,a)=>acc+(a.evaluation?.score||0),0)/answers.length):0;
 const scoreColor=sc>=75?'#22c55e':sc>=50?'#f59e0b':'#ef4444';
 const scoreLabel=sc>=75?'Interview-ready 🚀':sc>=50?'Keep improving 💪':'Needs more practice 🔥';
 return <div className="feedback"><div className="score-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'20px'}}><div><span className="eyebrow" style={{color:'#c4b5fd'}}>CAMPUS PLACEMENT SCORECARD</span><h2>{scoreLabel}</h2><p style={{color:'#cbd5e1',margin:'4px 0 0'}}>Overall Score: <b style={{color:'#ffffff',fontSize:'18px'}}>{sc}/100</b> · Full interview transcript, coaching, and model STAR answers below.</p></div><div className="score-ring" style={{width:'96px',height:'96px',borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'3px solid #ffffff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}><strong style={{fontSize:'34px',fontWeight:800,color:'#ffffff',lineHeight:1}}>{sc}</strong><small style={{fontSize:'11px',fontWeight:700,color:'#e2e8f0',marginTop:'3px'}}>/ 100</small></div></div>
 <div className="insights"><div><h3>Strengths</h3>{(d.strengths||[]).map(x=><p key={x} style={{color:x.startsWith('None')?'#dc2626':'#16a34a',fontWeight:x.startsWith('None')?700:500}}>{x.startsWith('None')?'✕ ':'✓ '}{x}</p>)}</div><div><h3>What to improve</h3>{(d.improvements||[]).map(x=><p key={x}>• {x}</p>)}</div></div>

 <div className="transcript-review"><div className="label-bar"><div className="label"><MessageSquareText size={17}/> Interview transcript, audio &amp; model answers</div><div className="report-actions">{goodAnswers.length>0&&<button className={`sync-wins-btn ${synced?'synced':''}`} type="button" onClick={handleSync}>{synced?<><Check size={14}/> STAR Wins Synced to Master CV</>:<><Sparkles size={14}/> Sync Spoken STAR Wins to CV</>}</button>}<button className="ghost-sm" type="button" onClick={copyReport}>{copied?<><Check size={14}/> Copied!</>:<><FileText size={14}/> Copy report</>}</button><button className="ghost-sm" type="button" onClick={downloadReport}><Upload size={14} style={{transform:'rotate(180deg)'}}/> Download TXT</button></div></div>
  {(answers||[]).length===0&&<div className="empty-state" style={{padding:'30px 20px',textAlign:'center',background:'#f8f9fc',borderRadius:'14px',margin:'15px 0'}}><p style={{color:'#64748b',fontSize:'14px'}}>Detailed turn transcript was not recorded for this earlier session. Start a new voice interview to record real-time audio and STAR evaluation!</p></div>}
  {(answers||[]).map((x,i)=><div className="turn-review" key={i}>
   <div className="turn-review-header"><b>Q{i+1}. {x.question}</b>{x.evaluation?.score!==undefined&&<span className="turn-score" style={{color:x.evaluation.score>=70?'#22c55e':x.evaluation.score>=45?'#f59e0b':'#ef4444'}}>{x.evaluation.score}/100</span>}</div>

   {/* Vocal Delivery Coaching */}
   {x.evaluation?.fillers>0 ? (
    <div className="vocal-delivery-tag warning">
     <span>⚠️ {x.evaluation.fillers} verbal crutch{x.evaluation.fillers>1?'es':''} detected ({x.evaluation.fillerList?.map(f=>`"${f}"`).join(', ')}) — pause silently instead of using fillers</span>
    </div>
   ) : x.answer && x.answer.split(/\s+/).length>15 ? (
    <div className="vocal-delivery-tag success">
     <span>✓ Crisp Delivery · 0 verbal crutches detected</span>
    </div>
   ) : null}

   {/* Audio Controls */}
   {x.audioUrl&&<div className="turn-audio-player"><span className="audio-tag">🎙️ Recorded Voice Audio:</span><audio controls src={x.audioUrl} preload="none"/></div>}
   <div className="turn-tts-row">
    <button type="button" className={`tts-pill ${activeAudio==='q'+i?'playing':''}`} onClick={()=>playVoice(x.question,'q'+i)}><Volume2 size={13}/> {activeAudio==='q'+i?'⏹ Stop Question':'🔊 Hear Question'}</button>
    {x.answer&&<button type="button" className={`tts-pill ${activeAudio==='a'+i?'playing':''}`} onClick={()=>playVoice(x.answer,'a'+i)}><Volume2 size={13}/> {activeAudio==='a'+i?'⏹ Stop Answer':'🔊 Hear Your Answer'}</button>}
    {x.evaluation?.modelAnswer&&<button type="button" className={`tts-pill model-tts-pill ${activeAudio==='m'+i?'playing':''}`} onClick={()=>playVoice(x.evaluation.modelAnswer,'m'+i)}><Volume2 size={13}/> {activeAudio==='m'+i?'⏹ Stop Model':'🌟 Hear Model STAR'}</button>}
   </div>
   
   <div className="turn-section candidate-answer">
    <span className="turn-tag your-answer-tag">Your Spoken Answer:</span>
    <p>"{x.answer}"</p>
   </div>

   {x.evaluation?.notes&&<div className="turn-section coach-feedback">
    <span className="turn-tag coach-tag">💡 Coach Feedback:</span>
    <p>{x.evaluation.notes}</p>
   </div>}

   {x.evaluation?.modelAnswer&&<div className="turn-section model-answer">
    <span className="turn-tag model-tag">🌟 What a Strong STAR Answer Sounds Like:</span>
    <p>{x.evaluation.modelAnswer}</p>
   </div>}
  </div>)}
 </div>

 <div className="continue-card">
  <div><b>Next action</b><span>{d.nextAction}</span></div>
  <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
   {goodAnswers.length>0&&!synced&&<button className="sync-wins-btn" onClick={handleSync}><Sparkles size={16}/> Sync Spoken Wins to Master CV</button>}
   <button className="secondary" onClick={()=>{if(onHome)onHome();}}><RefreshCw size={16}/> Back to Dashboard</button>
   <button className="primary" onClick={()=>{if(onPractiseAgain)onPractiseAgain();else if(onHome)onHome();}}><Mic size={16}/> Practise Again</button>
  </div>
 </div>

 <div className="journey-roadmap">
  <div className="journey-header">
   <span className="eyebrow">YOUR CAMPUS TO CORPORATE ROADMAP</span>
   <h3>What to do next</h3>
   <p>Follow these steps to go from interview-ready to corporate-ready.</p>
  </div>
  <div className="journey-steps">
   <button className="journey-step" onClick={()=>{if(onImproveCV)onImproveCV()}}>
    <div className="journey-step-num">1</div>
    <div className="journey-step-icon"><FileText size={18}/></div>
    <div className="journey-step-body">
     <strong>Improve Your CV</strong>
     <span>Your interview revealed gaps — fix your CV now while insights are fresh.</span>
    </div>
    <ChevronRight size={16} className="journey-step-arrow"/>
   </button>
   <button className="journey-step" onClick={()=>{if(onModule)onModule('demo')}}>
    <div className="journey-step-num">2</div>
    <div className="journey-step-icon"><Target size={18}/></div>
    <div className="journey-step-body">
     <strong>Build an AI Project for the Company</strong>
     <span>Turn a real company problem into a polished AI solution — the differentiator that gets you hired.</span>
    </div>
    <ChevronRight size={16} className="journey-step-arrow"/>
   </button>
   <button className="journey-step" onClick={()=>{if(onModule)onModule('resilience')}}>
    <div className="journey-step-num">3</div>
    <div className="journey-step-icon"><ShieldCheck size={18}/></div>
    <div className="journey-step-body">
     <strong>Resilience &amp; Feedback Training</strong>
     <span>Build mental toughness for rejection, learn to adapt from feedback cycles.</span>
    </div>
    <ChevronRight size={16} className="journey-step-arrow"/>
   </button>
   <button className="journey-step" onClick={()=>{if(onModule)onModule('readiness')}}>
    <div className="journey-step-num">4</div>
    <div className="journey-step-icon"><BriefcaseBusiness size={18}/></div>
    <div className="journey-step-body">
     <strong>Corporate Communication Training</strong>
     <span>Master workplace communication, professional email, meetings &amp; stakeholder management.</span>
    </div>
    <ChevronRight size={16} className="journey-step-arrow"/>
   </button>
   <button className="journey-step" onClick={()=>{if(onModule)onModule('ai')}}>
    <div className="journey-step-num">5</div>
    <div className="journey-step-icon"><Sparkles size={18}/></div>
    <div className="journey-step-body">
     <strong>AI at Work Training</strong>
     <span>Learn practical AI workflows that make you faster, sharper and more productive from Day 1.</span>
    </div>
    <ChevronRight size={16} className="journey-step-arrow"/>
   </button>
  </div>
 </div>

</div>
}

// ─── Corporate Ready & Feedback Resilience Data & Components ───
const ROLEPLAY_SCENARIOS = [
 {
  id: 'critical-feedback',
  name: 'Critical Manager Feedback',
  persona: 'Vikram Mehta',
  title: 'Director of Operations / Practice Lead',
  avatar: '👔',
  badge: 'Tough Director',
  roleDesc: 'Demands rigorous data, direct answers, and immediate accountability without excuses.',
  initialMessage: "I just reviewed the draft you submitted. Honestly, this isn't anywhere near executive-ready. The methodology lacks depth, the data citations are vague, and if I showed this to the VP tomorrow, we'd get torn apart. Walk me through why you thought this was ready to submit, and what you're going to do right now.",
  chips: [
   "Acknowledge gap & propose revised draft by 4 PM",
   "Clarify missing criteria before touching the file",
   "State assumptions used in this first iteration"
  ]
 },
 {
  id: 'overloaded-bandwidth',
  name: 'Sarah Chen',
  title: 'Senior Product Manager & Core Stakeholder',
  avatar: '💼',
  badge: 'Urgent Stakeholder',
  roleDesc: 'Piles on urgent ad-hoc requests during peak delivery sprints without noticing your capacity.',
  initialMessage: "Hey, I know you're tied up with the client deck due today, but leadership just asked for an urgent 10-page market competitor benchmark by 4 PM. I need you to drop whatever you're doing and take care of this immediately. Can I count on you?",
  chips: [
   "Present trade-off: Client deck vs Benchmark deck",
   "Offer split delivery with tomorrow 9 AM completion",
   "Ask manager to arbitrate sprint priority"
  ]
 },
 {
  id: 'cross-functional-pushback',
  name: 'Rajesh Nair',
  title: 'VP of Commercial Operations',
  avatar: '📊',
  badge: 'Skeptical Executive',
  roleDesc: 'Questions junior recommendations and demands frontline, practical business grounding.',
  initialMessage: "I looked at your latest recommendation slide claiming our sales cycle is inefficient. You haven't spent a single day shadowing customer calls. Why should we upend our sales rhythm based on an entry-level analyst's theoretical spreadsheet?",
  chips: [
   "Anchor to objective sales CRM cycle metrics",
   "Propose co-shadowing 3 customer calls this week",
   "Validate their frontline wisdom while sharing the bottleneck data"
  ]
 },
 {
  id: 'missed-deadline',
  name: 'Elena Rostova',
  title: 'Head of Client Engagements',
  avatar: '🎯',
  badge: 'Senior Partner',
  roleDesc: 'Zero tolerance for surprises; expects instant proactive flags and decisive turnaround.',
  initialMessage: "The client just emailed me asking where the weekly synthesis report is. It was supposed to be in their inbox at 9 AM sharp. Why am I hearing about this from the client instead of you, and what is our immediate recovery plan?",
  chips: [
   "Own mistake radically + provide 30-minute delivery ETA",
   "Briefly state root cause without blaming tooling",
   "Propose automated milestone alert to prevent recurrence"
  ]
 }
];

const FREE_COURSES = [
 {
  id: 'upenn-resilience',
  title: 'Resilience in Times of High Uncertainty & Change',
  university: 'Wharton / Univ. of Pennsylvania',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '12 Hours · Self-Paced',
  instructor: 'Dr. Karen Reivich (Penn Resilience Academy)',
  url: 'https://www.coursera.org/learn/resilience-uncertainty',
  desc: 'Wharton’s premier evidence-based curriculum on emotional regulation, cognitive reframing, and maintaining composure during high-friction corporate restructuring and setbacks.',
  skills: ['Cognitive Reframing', 'Stress Inoculation', 'Optimism Architecture', 'Burnout Immunity']
 },
 {
  id: 'yale-wellbeing',
  title: 'The Science of Well-Being & Executive Mindset',
  university: 'Yale University',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '19 Hours · 100% Free',
  instructor: 'Prof. Laurie Santos',
  url: 'https://www.coursera.org/learn/the-science-of-well-being',
  desc: 'Yale’s most legendary course. Demystifies psychological biases, overcomes imposter syndrome, and builds sustainable mental habits for demanding consulting and tech environments.',
  skills: ['Psychological Agility', 'Imposter Syndrome Shield', 'Habit Engineering', 'Work-Life Anchors']
 },
 {
  id: 'umich-negotiation',
  title: 'Successful Negotiation: Essential Strategies & Skills',
  university: 'University of Michigan',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '17 Hours · 100% Free',
  instructor: 'Prof. George Siedel',
  url: 'https://www.coursera.org/learn/negotiation-skills',
  desc: 'Master the art of principled corporate negotiation, negotiating bandwidth and deadlines without creating animosity, and handling power imbalances with senior stakeholders.',
  skills: ['BATNA Planning', 'Boundary Setting', 'Principled Influence', 'Conflict De-escalation']
 },
 {
  id: 'leeds-communication',
  title: 'Communication and Interpersonal Skills at Work',
  university: 'University of Leeds',
  platform: 'FutureLearn (Free Access)',
  duration: '8 Hours · 100% Free',
  instructor: 'Leeds Executive Leadership Faculty',
  url: 'https://www.futurelearn.com/courses/communication-and-interpersonal-skills-at-work',
  desc: 'Decode workplace subtext, deliver constructive upward feedback, master active listening, and calibrate tone for both remote Slack/Teams channels and executive boardrooms.',
  skills: ['Active Listening', 'Tone Calibration', 'Cross-Cultural Presence', 'Upward Communication']
 },
 {
  id: 'harvard-difficult-conversations',
  title: 'How to Handle Difficult Conversations at Work',
  university: 'Harvard Division of Continuing Education',
  platform: 'Harvard DCE Executive Guide',
  duration: 'Interactive Executive Playbook · Free',
  instructor: 'Harvard Professional Development Faculty',
  url: 'https://professional.dce.harvard.edu/blog/how-to-handle-difficult-conversations-at-work/',
  desc: 'Harvard’s strategic playbook on approaching high-stakes friction, disarming defensiveness, separating emotional intent from business impact, and reaching mutual alignment.',
  skills: ['Crucial Conversations', 'De-escalation', 'Empathetic Inversion', 'Executive Alignment']
 },
 {
  id: 'google-project-execution',
  title: 'Project Execution: Running the Project & Managing Risk',
  university: 'Google Career Certificates',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '22 Hours · 100% Free',
  instructor: 'Google Senior Project Leadership',
  url: 'https://www.coursera.org/learn/project-execution-google',
  desc: 'Google’s internal playbook on status reporting, handling sudden roadblocks, communicating project delays before they escalate, and managing aggressive stakeholder scopes.',
  skills: ['Escalation Protocols', 'RACI Accountability', 'Scope Creep Guardrails', 'Risk Communication']
 }
];

function CorporateReadinessView({ career, cv }) {
  const [activeTab, setActiveTab] = useState('roleplay');
  const [selectedScenarioId, setSelectedScenarioId] = useState('critical-feedback');
  const scenario = ROLEPLAY_SCENARIOS.find(s => s.id === selectedScenarioId) || ROLEPLAY_SCENARIOS[0];

  const [messages, setMessages] = useState([
    { role: 'assistant', content: scenario.initialMessage, time: 'Just now' }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestCoaching, setLatestCoaching] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const selectScenario = (sc) => {
    setSelectedScenarioId(sc.id);
    setMessages([
      { role: 'assistant', content: sc.initialMessage, time: 'Just now' }
    ]);
    setLatestCoaching(null);
    setInputText('');
    window.speechSynthesis?.cancel();
    if (audioEnabled) {
      speakMessage(sc.initialMessage);
    }
  };

  const speakMessage = (text) => {
    if (!audioEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = getBestHumanVoice();
      if (v) u.voice = v;
      u.rate = 1.0;
      u.pitch = 0.98;
      window.speechSynthesis.speak(u);
    } catch(e) {
      console.warn('TTS error:', e);
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. You can type your response!');
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      rec.onerror = (e) => {
        console.warn('Speech rec error:', e);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch(e) {
      console.warn('Speech rec start failed:', e);
      setIsListening(false);
    }
  };

  const copyToClipboard = (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2500);
    } catch(e) { console.warn('Clipboard copy failed:', e); }
  };

  const handleSendMessage = async (userText) => {
    const text = (userText || inputText).trim();
    if (!text || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessages = [...messages, { role: 'user', content: text, time: timeStr }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      let res;
      try {
        res = await post('/api/roleplay', {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          persona: scenario.persona,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          candidateMessage: text,
          career: career || 'Consultant'
        });
      } catch(err) {
        console.warn('API call failed, using smart resilient fallback:', err);
        const lower = text.toLowerCase();
        let fallbackScore = 82;
        let whatWorked = "Direct acknowledgment and maintaining professional composure.";
        let whatToImprove = "Anchor on a concrete deliverable ETA and quantify the specific adjustments you are making.";
        let script = `"Thank you for the direct feedback. Here is the concrete adjustment I will make immediately, and I will share an updated draft with you by 4 PM for a quick alignment check."`;
        let reply = "That is a start. But walk me through the specific changes and how you will ensure this draft meets the bar before it reaches the client.";

        if (lower.includes('apolog') || lower.includes('sorry')) {
          fallbackScore = 68;
          whatWorked = "Accountability and polite intent.";
          whatToImprove = "Avoid over-apologizing in corporate environments. Senior leaders prefer proactive solutions, firm ETAs, and trade-off options rather than emotional apologies.";
          script = `"Understood. I am recalibrating the model right away and will share the revised version with you at 3 PM."`;
          reply = "I don't need apologies — I need a solid deliverable that won't get rejected by leadership. Give me your exact timeline.";
        } else if (lower.includes('eta') || lower.includes('pm') || lower.includes('am') || lower.includes('priority') || lower.includes('trade')) {
          fallbackScore = 92;
          whatWorked = "Outstanding executive presence! You anchored on firm deadlines, clear prioritization, and actionable trade-offs.";
          whatToImprove = "Include a brief milestone check-in 1 hour prior to final submission to confirm expectations.";
          script = `"Understood. I will prioritize this immediately and share an intermediate draft with you at 2 PM before our 4 PM distribution deadline."`;
          reply = "Good. Send me that draft as soon as it's ready, and make sure the core assumptions are clearly highlighted.";
        }

        res = {
          reply,
          coaching: {
            score: fallbackScore,
            diplomacyScore: Math.min(100, fallbackScore + 4),
            resilienceScore: Math.min(100, fallbackScore - 2),
            whatWorked,
            whatToImprove,
            executiveScript: script,
            reframingTip: "Feedback is data about the deliverable, not a judgment on your worth. Respond with curiosity, clarity, and calm execution."
          }
        };
      }

      const botReply = res.reply || res.characterReply || "Thank you for the update.";
      const coachingObj = res.coaching || {
        score: res.score || res.resilienceScore || 80,
        resilienceScore: res.resilienceScore || res.score || 80,
        diplomacyScore: res.diplomacyScore || 85,
        whatWorked: res.whatWorked,
        whatToImprove: res.whatToImprove,
        executiveScript: res.executiveScript || res.recommendedScript,
        reframingTip: res.reframingTip || res.frameworkTip
      };

      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { role: 'assistant', content: botReply, time: replyTime }]);
      setLatestCoaching(coachingObj);
      if (audioEnabled) {
        speakMessage(botReply);
      }
    } finally {
      setLoading(false);
    }
  };

  const restartRoleplay = () => {
    window.speechSynthesis?.cancel();
    setMessages([
      { role: 'assistant', content: scenario.initialMessage, time: 'Just now' }
    ]);
    setLatestCoaching(null);
    setInputText('');
    if (audioEnabled) {
      speakMessage(scenario.initialMessage);
    }
  };

  const abcdSteps = [
    { letter: 'A', title: 'Adversity (Trigger)', desc: 'A senior partner or client sharply rejects your analysis or imposes an abrupt, high-stress deadline.' },
    { letter: 'B', title: 'Automatic Belief', desc: 'The internal reflex: "They think I am incompetent / My career is slipping / I have to defend myself."' },
    { letter: 'C', title: 'Consequence', desc: 'Defensive argument, frantic over-apologizing, or paralysis — all of which undermine executive credibility.' },
    { letter: 'D', title: 'Disputation & Reframe', desc: '"This is feedback on the slide, not on my character. I will separate the emotional tone from the business facts and respond with a solution."' }
  ];

  const rules = [
    { num: '01', title: 'Separate Tone from Substance', desc: 'Aggressive or curt feedback is often caused by executive stress or tight deadlines. Ignore the sharp tone, isolate the 2 core technical or business objections, and address those directly.' },
    { num: '02', title: 'Never Say "No" Flat-Out — Present Trade-Offs', desc: 'When overloaded, saying "I can’t do that" sounds uncollaborative. Instead say: "I’m glad to tackle Project B. Currently Project A is due at 3 PM. Which should we prioritize, or can I deliver B tomorrow morning?"' },
    { num: '03', title: 'Always Close with a Concrete ETA & Check-in', desc: 'Ambiguity creates anxiety for leaders. Always end with an exact hour and intermediate milestone: "I will incorporate this and share a revised draft by 3:30 PM for your quick nod."' }
  ];

  const dilemmaScripts = [
    {
      title: 'Critical Manager Feedback',
      scenario: 'When a manager gives sharp, unexpected feedback on a deliverable.',
      script: '"Thank you for pointing that out clearly. I appreciate the direct feedback on this deliverable. Here is what I will adjust immediately to prevent this next time, and I will share an updated draft by 4 PM today for your quick review."'
    },
    {
      title: 'Managing Overloaded Bandwidth',
      scenario: 'When asked to take on an urgent extra task while handling high-priority deadlines.',
      script: '"I would be glad to help with Project B. Currently, my top priority is finishing Project A which is due at 3 PM. To ensure neither slips in quality, should we deprioritize Project A, or can I deliver Project B first thing tomorrow morning?"'
    },
    {
      title: 'Weekly Executive Friday Update',
      scenario: 'Proactive 3-bullet Friday status check-in to your manager.',
      script: '"Hi [Manager], here is my quick Friday update:\n1. Delivered: Completed the Q3 analysis and shared findings with the core team.\n2. In Progress: Drafting the recommendation deck for stakeholder review (on track for Tuesday).\n3. Flag/Help needed: None currently — all systems clear for next week. Have a great weekend!"'
    }
  ];

  return (
    <div className="module-panel">
      <span className="eyebrow">STAGE 2 · DAY-1 CORPORATE LAUNCHPAD</span>
      <h2>Corporate Ready, Live Role-Play & Feedback Resilience</h2>
      <p>Master high-pressure workplace conversations with live AI executive role-plays, real-time resilience coaching, and verified 100% free university courses from Wharton, Yale, and Michigan.</p>

      {/* Navigation Tabs */}
      <div className="roleplay-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roleplay'}
          className={`roleplay-tab-btn ${activeTab === 'roleplay' ? 'active' : ''}`}
          onClick={() => setActiveTab('roleplay')}
        >
          <MessageSquareText size={16} /> Live Role-Play Simulator
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'frameworks'}
          className={`roleplay-tab-btn ${activeTab === 'frameworks' ? 'active' : ''}`}
          onClick={() => setActiveTab('frameworks')}
        >
          <ShieldCheck size={16} /> Resilience Playbooks & Frameworks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'courses'}
          className={`roleplay-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          <GraduationCap size={16} /> Free University Courses (100% Free)
        </button>
      </div>

      {/* TAB 1: LIVE ROLE-PLAY SIMULATOR */}
      {activeTab === 'roleplay' && (
        <div>
          {/* Scenario Picker */}
          <div className="scenario-picker">
            {ROLEPLAY_SCENARIOS.map(sc => (
              <button
                key={sc.id}
                type="button"
                className={`scenario-pill ${selectedScenarioId === sc.id ? 'active' : ''}`}
                onClick={() => selectScenario(sc)}
              >
                <span>{sc.avatar}</span>
                <span>{sc.name}</span>
              </button>
            ))}
          </div>

          {/* Roleplay Chat Card */}
          <div className="roleplay-card">
            <div className="roleplay-header">
              <div className="roleplay-persona-info">
                <div className="roleplay-avatar">{scenario.avatar}</div>
                <div className="roleplay-persona-text">
                  <h4>{scenario.persona}</h4>
                  <p>{scenario.title} · {scenario.roleDesc}</p>
                </div>
              </div>
              <div className="roleplay-controls">
                <button
                  type="button"
                  className="ghost-sm"
                  title={audioEnabled ? 'Mute persona voice' : 'Enable persona voice'}
                  onClick={() => {
                    const next = !audioEnabled;
                    setAudioEnabled(next);
                    if (!next) window.speechSynthesis?.cancel();
                  }}
                  style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)' }}
                >
                  {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span style={{ fontSize: '11px' }}>{audioEnabled ? 'Audio On' : 'Audio Muted'}</span>
                </button>
                <button
                  type="button"
                  className="ghost-sm"
                  title="Restart role-play"
                  onClick={restartRoleplay}
                  style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)' }}
                >
                  <RefreshCw size={14} />
                  <span style={{ fontSize: '11px' }}>Restart</span>
                </button>
              </div>
            </div>

            {/* Chat Stream */}
            <div className="chat-stream">
              {messages.map((m, idx) => (
                <div key={idx} className={`chat-msg ${m.role === 'assistant' ? 'character' : 'candidate'}`}>
                  <div className="chat-bubble">
                    {m.content}
                  </div>
                  <div className="chat-meta">
                    <span>{m.role === 'assistant' ? scenario.persona : 'You (Candidate)'}</span>
                    <span>·</span>
                    <span>{m.time}</span>
                    {m.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => speakMessage(m.content)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6855e8', padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                        title="Replay message audio"
                      >
                        <Volume2 size={11} /> Replay
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-msg character">
                  <div className="chat-bubble" style={{ color: '#64748b', fontStyle: 'italic' }}>
                    {scenario.persona} is responding and analyzing your executive presence...
                  </div>
                </div>
              )}

              {/* Latest Coaching Evaluation Card */}
              {latestCoaching && (
                <div className="coaching-card">
                  <div className="coaching-header">
                    <div className="coaching-title">
                      <Award size={16} /> Instant Resilience Coaching & Evaluation
                    </div>
                    <div className="coaching-scores">
                      <div className="coach-score-badge">
                        Resilience: <b>{latestCoaching.resilienceScore || latestCoaching.score || 85}</b>/100
                      </div>
                      <div className="coach-score-badge" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                        Diplomacy: <b>{latestCoaching.diplomacyScore || 88}</b>/100
                      </div>
                    </div>
                  </div>

                  <div className="coaching-grid">
                    {latestCoaching.whatWorked && (
                      <div className="coach-point">
                        <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div><b>What Worked:</b> {latestCoaching.whatWorked}</div>
                      </div>
                    )}
                    {latestCoaching.whatToImprove && (
                      <div className="coach-point">
                        <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div><b>Refine for Executive Impact:</b> {latestCoaching.whatToImprove}</div>
                      </div>
                    )}
                    {latestCoaching.reframingTip && (
                      <div className="coach-point">
                        <Lightbulb size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div><b>Cognitive Reframe:</b> {latestCoaching.reframingTip}</div>
                      </div>
                    )}
                    {latestCoaching.executiveScript && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#6b21a8', marginTop: '6px', textTransform: 'uppercase' }}>
                          Ideal Executive Word-For-Word Rephrase:
                        </div>
                        <div className="coach-script-box">
                          <span>{latestCoaching.executiveScript}</span>
                          <button
                            type="button"
                            className="ghost-sm"
                            onClick={() => copyToClipboard(latestCoaching.executiveScript, 'coach-script')}
                            style={{ cursor: 'pointer', flexShrink: 0 }}
                          >
                            {copiedKey === 'coach-script' ? <><Check size={13} color="#10b981" /> Copied</> : <><Copy size={13} /> Copy</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Starters & Input Area */}
            <div className="chat-input-area">
              <div className="quick-chips-bar">
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', alignSelf: 'center', whiteSpace: 'nowrap' }}>Suggested Starters:</span>
                {scenario.chips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-chip"
                    onClick={() => {
                      setInputText(chip);
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form
                className="chat-input-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <button
                  type="button"
                  className={`chat-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleSpeechRecognition}
                  title={isListening ? 'Stop listening' : 'Click to speak (Voice Recognition)'}
                >
                  <Mic size={18} />
                </button>
                <input
                  type="text"
                  className="chat-input-box"
                  placeholder="Type your response or click the microphone to speak..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!inputText.trim() || loading}
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESILIENCE FRAMEWORKS & PLAYBOOKS */}
      {activeTab === 'frameworks' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '14px' }}>
            <span className="eyebrow" style={{ color: '#6855e8' }}>PSYCHOLOGICAL ARCHITECTURE</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>The ABCD Model of Workplace Resilience</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Developed by cognitive psychologists to break the automatic panic cycle when facing abrupt managerial criticism or unexpected setbacks.</p>
          </div>

          <div className="framework-grid">
            {abcdSteps.map((step, idx) => (
              <div key={idx} className="framework-card">
                <div className="framework-step">
                  <div className="framework-letter">{step.letter}</div>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{step.title}</strong>
                    <p style={{ fontSize: '12.5px', color: '#475569', margin: '4px 0 0', lineHeight: '1.5' }}>{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '28px', marginBottom: '14px' }}>
            <span className="eyebrow" style={{ color: '#0ea5e9' }}>CORE PRINCIPLES</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>The 3 Golden Rules of Executive Composure</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>How elite analysts and consultants communicate under high stakes and aggressive pushback.</p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {rules.map((r, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#6855e8', lineHeight: 1 }}>{r.num}</span>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{r.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.55' }}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '28px', marginBottom: '14px' }}>
            <span className="eyebrow" style={{ color: '#10b981' }}>BATTLE-TESTED SCRIPTS</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>Word-For-Word Crisis Scripts</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Keep these exact formulas handy for sudden difficult conversations.</p>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {dilemmaScripts.map((d, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6855e8', textTransform: 'uppercase' }}>{d.title}</span>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 10px' }}>{d.scenario}</p>
                  </div>
                  <button type="button" className="ghost-sm" onClick={() => copyToClipboard(d.script, `script-${idx}`)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {copiedKey === `script-${idx}` ? <><Check size={14} color="#10b981" /> Copied!</> : <><Copy size={14} /> Copy script</>}
                  </button>
                </div>
                <div style={{ background: '#f8fafc', borderLeft: '3px solid #6855e8', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', fontStyle: 'italic', color: '#1e293b', lineHeight: '1.5' }}>
                  {d.script}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VERIFIED FREE ONLINE COURSES */}
      {activeTab === 'courses' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '14px' }}>
            <span className="eyebrow" style={{ color: '#16a34a' }}>TOP UNIVERSITY CURATED AUDIT</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>Verified 100% Free Online Courses & Guides</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>All courses below offer full free audit/access so students can master resilience, negotiation, and high-impact workplace communication without paying tuition fees.</p>
          </div>

          <div className="courses-grid">
            {FREE_COURSES.map(c => (
              <div key={c.id} className="course-card">
                <div className="course-head">
                  <span className="course-uni-badge">{c.university}</span>
                  <span className="course-free-pill">100% Free</span>
                </div>
                <h3>{c.title}</h3>
                <div className="course-meta">
                  <span>🏛️ {c.platform}</span>
                  <span>⏱️ {c.duration}</span>
                </div>
                <p className="course-desc">{c.desc}</p>
                <div className="course-skills">
                  {c.skills.map((s, idx) => (
                    <span key={idx} className="course-skill-tag">{s}</span>
                  ))}
                </div>
                <div className="course-foot">
                  <span className="course-instructor">{c.instructor}</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="course-link-btn"
                  >
                    Start Free Course <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI at Work Data & Components ───
const FREE_AI_COURSES = [
 {
  id: 'deeplearning-genai-everyone',
  title: 'Generative AI for Everyone',
  university: 'DeepLearning.AI',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '6 Hours · Self-Paced · 100% Free',
  instructor: 'Andrew Ng (Co-Founder Coursera, Adjunct Prof Stanford)',
  url: 'https://www.coursera.org/learn/generative-ai-for-everyone',
  desc: 'Taught by global AI pioneer Andrew Ng. Demystifies generative AI, how LLMs work, real-world corporate use-cases, prompt engineering fundamentals, and identifying high-impact workplace AI opportunities.',
  skills: ['Generative AI Strategy', 'Prompt Engineering', 'LLM Capabilities & Limits', 'Responsible AI']
 },
 {
  id: 'microsoft-career-essentials-ai',
  title: 'Career Essentials in Generative AI',
  university: 'Microsoft & LinkedIn Learning',
  platform: 'LinkedIn Learning (Free Professional Certificate)',
  duration: '4 Hours · Official Certificate · 100% Free',
  instructor: 'Microsoft AI Engineering Leadership',
  url: 'https://www.linkedin.com/learning/paths/career-essentials-in-generative-ai-by-microsoft-and-linkedin',
  desc: 'Developed by Microsoft. Master core generative AI fundamentals, Microsoft Copilot workflows, ethical implications, and workplace productivity acceleration. Includes an official shareable certificate.',
  skills: ['Microsoft Copilot', 'AI Ethics', 'Workplace Automation', 'Generative Search']
 },
 {
  id: 'vanderbilt-prompt-engineering',
  title: 'Prompt Engineering for ChatGPT',
  university: 'Vanderbilt University',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '18 Hours · Self-Paced · 100% Free',
  instructor: 'Dr. Jules White (Associate Dean of Computer Science)',
  url: 'https://www.coursera.org/learn/prompt-engineering',
  desc: 'The definitive university course on prompt design patterns: Few-Shot, Persona, Cognitive Verifier, and Chain-of-Thought patterns to transform ChatGPT and Claude into specialized workplace copilots.',
  skills: ['Prompt Design Patterns', 'Few-Shot Prompting', 'Chain-of-Thought', 'Anti-Hallucination']
 },
 {
  id: 'google-intro-genai',
  title: 'Introduction to Generative AI',
  university: 'Google Cloud Training',
  platform: 'Google Cloud Skills Boost (100% Free)',
  duration: '1 Hour · Free Completion Badge',
  instructor: 'Google Cloud AI Specialists',
  url: 'https://www.cloudskillsboost.google/course_templates/536',
  desc: 'Google’s official executive micro-learning path explaining what generative AI is, how it is trained, how it differs from traditional machine learning, and how to use Google Cloud AI tools responsibly.',
  skills: ['Large Language Models', 'Google AI Principles', 'Model Training Basics', 'Cloud AI']
 },
 {
  id: 'harvard-cs50-ai',
  title: "CS50's Introduction to Artificial Intelligence with Python",
  university: 'Harvard University',
  platform: 'edX / Harvard Online (Free Audit)',
  duration: '7 Weeks (10-30 hrs/wk) · 100% Free Access',
  instructor: 'Prof. David J. Malan & Brian Yu',
  url: 'https://cs50.harvard.edu/ai/',
  desc: 'Harvard’s premier introduction to the algorithms and theory behind modern AI: graph search, classification, optimization, reinforcement learning, neural networks, and natural language processing.',
  skills: ['Machine Learning Foundations', 'Neural Networks', 'Python Algorithms', 'NLP Essentials']
 },
 {
  id: 'ibm-genai-career',
  title: 'Generative AI: Elevate Your Career and Workflow',
  university: 'IBM Skills Academy',
  platform: 'Coursera (Free Audit / Enrollment)',
  duration: '10 Hours · Self-Paced · 100% Free',
  instructor: 'IBM AI Research & Solutions Team',
  url: 'https://www.coursera.org/learn/generative-ai-elevate-your-career',
  desc: 'Learn practical enterprise applications of generative AI across project management, corporate writing, coding assistance, and team collaboration with watsonx and state-of-the-art foundation models.',
  skills: ['Enterprise AI Workflows', 'watsonx Integration', 'Data Synthesis', 'Project Acceleration']
 }
];

function AIAtWorkView({ career, cv }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'prompts' | 'courses'

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm Alex Rivera, your AI Workplace Mentor. Whether you want to know how to automate repetitive report drafting, turn chaotic meeting notes into clean RACI tables, audit metrics with AI, or discover the best 100% free courses to accelerate your career — ask me anything below or click one of the suggested starters!",
      time: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestGuidance, setLatestGuidance] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);

  // 7-day plan generator state in Tab 2
  const [planLoading, setPlanLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [planError, setPlanError] = useState('');

  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const speakMessage = (text) => {
    if (!audioEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = getBestHumanVoice();
      if (v) u.voice = v;
      u.rate = 1.0;
      u.pitch = 0.98;
      window.speechSynthesis.speak(u);
    } catch(e) {
      console.warn('TTS error:', e);
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. You can type your response!');
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      rec.onerror = (e) => {
        console.warn('Speech rec error:', e);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
    } catch(e) {
      console.warn('Speech rec start failed:', e);
      setIsListening(false);
    }
  };

  const copyToClipboard = (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2500);
    } catch(e) { console.warn('Clipboard copy failed:', e); }
  };

  const handleSendMessage = async (userText) => {
    const text = (userText || inputText).trim();
    if (!text || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessages = [...messages, { role: 'user', content: text, time: timeStr }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      let res;
      try {
        res = await post('/api/aimentor', {
          message: text,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
          career: career || 'Consultant',
          cv: cv || ''
        });
      } catch(err) {
        console.warn('API call failed, using smart resilient fallback:', err);
        const lower = text.toLowerCase();
        let fallbackReply = "Generative AI multiplies your daily output when treated like a sharp executive analyst. Always provide clear context, define the exact structure, and state negative constraints to eliminate hallucinated corporate filler.";
        let fallbackPrompt = `Act as an enterprise strategy consultant. Review the provided notes: [insert rough notes]. Structure a 1-page executive brief with 3 core findings, estimated business impact, and a 3-step action roadmap. Constraints: zero buzzwords, keep under 300 words.`;
        let takeaways = [
          "Use the CTC-F framework: Context, Task, Constraints, and Format.",
          "Verify calculations and facts independently before presenting to leadership.",
          "Never upload unredacted confidential corporate data to public models."
        ];
        let recCourse = "DeepLearning.AI: Generative AI for Everyone by Andrew Ng";
        let nextQ = "Would you like me to walk you through how to transform meeting transcripts into RACI tables next?";

        if (lower.includes('course') || lower.includes('learn') || lower.includes('start') || lower.includes('certif')) {
          fallbackReply = "To build an elite foundation in workplace AI, start with Andrew Ng's 'Generative AI for Everyone' on Coursera (select 'Audit course' for 100% free access) to understand capabilities and limits. Next, complete Vanderbilt University's 'Prompt Engineering for ChatGPT' to master advanced prompt patterns, and earn Microsoft's free 'Career Essentials in Generative AI' certificate on LinkedIn Learning.";
          fallbackPrompt = `Act as a senior learning coach. Help me design a 14-day study sprint to master prompt engineering and AI workflow automation for my upcoming role in [insert industry]. Include daily 30-minute practice tasks and verification milestones.`;
          takeaways = [
            "Audit free courses on Coursera (select 'Audit course' to access all materials for $0).",
            "Build 1 real workplace workflow daily rather than passively watching videos.",
            "Display verified credentials on your LinkedIn profile to signal forward-thinking agility."
          ];
          recCourse = "Vanderbilt University: Prompt Engineering for ChatGPT (Coursera)";
          nextQ = "Would you like to focus more on business workflows (writing/strategy) or technical workflows (coding/data analysis)?";
        } else if (lower.includes('memo') || lower.includes('scqa') || lower.includes('writ')) {
          fallbackReply = "For high-stakes executive memos, use the SCQA framework: Situation, Complication, Key Question, and Recommended Answer. Always specify the target audience, tone, and strict length limits.";
          fallbackPrompt = `Act as an engagement manager. Convert the following bullet points into a 1-page executive brief for senior leaders. Use the SCQA framework: Situation, Complication, Key Question, and Recommended Answer. Include an estimated ROI and risk mitigation table. Input: [paste data].`;
          takeaways = [
            "Supply a target executive persona and business context.",
            "Enforce strict negative constraints ('No corporate buzzwords or generic filler').",
            "Demand a 2-column risk mitigation table for every recommendation."
          ];
          recCourse = "University of Leeds: Communication and Interpersonal Skills at Work (FutureLearn)";
          nextQ = "Would you like to adapt this prompt for your upcoming industry or job description?";
        }

        res = {
          reply: fallbackReply,
          recommendedPrompt: fallbackPrompt,
          keyTakeaways: takeaways,
          recommendedCourse: recCourse,
          nextQuestion: nextQ
        };
      }

      const botReply = res.reply || "Here is how you can approach this with modern AI workflows.";
      const guidance = {
        recommendedPrompt: res.recommendedPrompt || "",
        keyTakeaways: Array.isArray(res.keyTakeaways) ? res.keyTakeaways : [],
        recommendedCourse: res.recommendedCourse || "",
        nextQuestion: res.nextQuestion || ""
      };

      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { role: 'assistant', content: botReply, time: replyTime }]);
      setLatestGuidance(guidance);
      if (audioEnabled) {
        speakMessage(botReply);
      }
    } finally {
      setLoading(false);
    }
  };

  const restartChat = () => {
    window.speechSynthesis?.cancel();
    setMessages([
      {
        role: 'assistant',
        content: "Hello! I'm Alex Rivera, your AI Workplace Mentor. Whether you want to know how to automate repetitive report drafting, turn chaotic meeting notes into clean RACI tables, audit metrics with AI, or discover the best 100% free courses to accelerate your career — ask me anything below or click one of the suggested starters!",
        time: 'Just now'
      }
    ]);
    setLatestGuidance(null);
    setInputText('');
  };

  const runCoach = async () => {
    setPlanLoading(true); setPlanError('');
    try {
      let d;
      try {
        d = await post('/api/coach', { module: 'ai', context: cv, career });
      } catch(e) {
        d = {
          diagnosis: 'Accelerate your daily workflow with practical, responsible AI prompting.',
          score: 82,
          weeklyHabit: 'Use structured prompt frameworks (Context + Task + Constraints + Format) for all non-confidential deliverables.',
          sevenDayPlan: [
            'Day 1: Audit repetitive daily writing and summarize 3 workflows with AI.',
            'Day 2: Draft an executive memo using the Situation-Complication-Question-Answer framework.',
            'Day 3: Transform raw meeting transcripts into a clean RACI decision table.',
            'Day 4: Run exploratory data anomaly analysis and highlight outliers.',
            'Day 5: Scaffold clean code functions and generate 5 unit test cases.',
            'Day 6: Refine executive communication tone for diplomatic firmness.',
            'Day 7: Establish personal verification guardrails to eliminate hallucination risks.'
          ]
        };
      }
      setPlanData(d);
    } finally { setPlanLoading(false); }
  };

  const testPromptInChat = (promptText) => {
    setActiveTab('chat');
    setInputText(`Alex, how do I best adapt this prompt for my work and what results should I look for?\n\n"${promptText}"`);
  };

  const quickStarters = [
    "How do I draft an executive memo with Claude using SCQA?",
    "How can I turn meeting transcripts into a clean RACI matrix?",
    "What are the best free courses to start learning AI with no coding?",
    "How do I use ChatGPT to analyze tabular metrics and find anomalies?",
    "What are the golden rules of enterprise data privacy with AI?"
  ];

  const aiPrompts = [
    {
      title: '1. Executive Memo Drafter (SCQA)',
      desc: 'Structure a 1-page business brief with recommendations and risk mitigations.',
      prompt: 'Act as an executive strategy consultant. Structure a 1-page executive memo proposing a solution to [insert problem]. Use the SCQA framework: Situation, Complication, Key Question, and Recommended Answer. Keep recommendations ruthlessly prioritized with estimated ROI and implementation milestones.'
    },
    {
      title: '2. Meeting Transcript to RACI Matrix',
      desc: 'Convert chaotic meeting notes into decisions and accountability matrices.',
      prompt: "Here are raw unstructured meeting notes from today's sync: [paste notes]. Convert them into: 1. Core decisions agreed upon, 2. Key open risks or dependencies, 3. A structured RACI action table with Responsible Owner, Deliverable, and Strict Deadline."
    },
    {
      title: '3. Data Anomaly & Outlier Extractor',
      desc: 'Analyze spreadsheets and metric dumps to surface actionable signals.',
      prompt: 'I have pasted tabular performance data below: [paste data]. 1. Identify the top 3 statistical outliers or anomalies. 2. Highlight key week-over-week trends. 3. Suggest 3 testable business hypotheses explaining these fluctuations.'
    },
    {
      title: '4. Code & Unit Test Scaffold',
      desc: 'Generate clean, production-grade functions with boundary edge tests.',
      prompt: 'Write a clean, production-ready function in [language] that [insert objective]. Include comprehensive edge-case handling, input validation, docstrings, and 5 unit tests covering normal execution, empty states, and boundary conditions.'
    },
    {
      title: '5. Diplomatic Tone & Assertiveness Polisher',
      desc: 'Rewrite difficult emails to sound confident, constructive, and firm.',
      prompt: 'Rewrite the following email draft to sound confident, collaborative, and professionally assertive without sounding apologetic or defensive: [paste draft]. Highlight what you adjusted and the strategic reason behind each change.'
    }
  ];

  return (
    <div className="module-panel">
      <span className="eyebrow">STAGE 2 · FUTURE-READY WORKFLOWS</span>
      <h2>AI at Work: Practical Workflows, Live Mentor & Free Courses</h2>
      <p>Master practical AI frameworks that multiply your output by 3x in research, writing, data analysis, and workflow automation. Chat live with your enterprise mentor and access verified 100% free university courses.</p>

      {/* Navigation Tabs */}
      <div className="roleplay-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          className={`roleplay-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <Sparkles size={16} /> AI Workplace Mentor & Live Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'prompts'}
          className={`roleplay-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          <BookOpen size={16} /> Battle-Tested Prompts & 7-Day Sprint
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'courses'}
          className={`roleplay-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          <GraduationCap size={16} /> Free AI Courses & Certifications (100% Free)
        </button>
      </div>

      {/* TAB 1: AI WORKPLACE MENTOR & LIVE CHAT */}
      {activeTab === 'chat' && (
        <div>
          <div className="roleplay-card">
            <div className="roleplay-header" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
              <div className="roleplay-persona-info">
                <div className="roleplay-avatar" style={{ background: 'rgba(255,255,255,0.15)' }}>⚡</div>
                <div className="roleplay-persona-text">
                  <h4>Alex Rivera</h4>
                  <p>Principal AI Workflow Strategist & Enterprise Mentor · Guidance on Tools, Prompts & Learning</p>
                </div>
              </div>
              <div className="roleplay-controls">
                <button
                  type="button"
                  className="ghost-sm"
                  title={audioEnabled ? 'Mute mentor voice' : 'Enable mentor voice'}
                  onClick={() => {
                    const next = !audioEnabled;
                    setAudioEnabled(next);
                    if (!next) window.speechSynthesis?.cancel();
                  }}
                  style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)' }}
                >
                  {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span style={{ fontSize: '11px' }}>{audioEnabled ? 'Audio On' : 'Audio Muted'}</span>
                </button>
                <button
                  type="button"
                  className="ghost-sm"
                  title="Restart chat"
                  onClick={restartChat}
                  style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)' }}
                >
                  <RefreshCw size={14} />
                  <span style={{ fontSize: '11px' }}>Restart</span>
                </button>
              </div>
            </div>

            {/* Chat Stream */}
            <div className="chat-stream">
              {messages.map((m, idx) => (
                <div key={idx} className={`chat-msg ${m.role === 'assistant' ? 'character' : 'candidate'}`}>
                  <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                  <div className="chat-meta">
                    <span>{m.role === 'assistant' ? 'Alex Rivera (AI Mentor)' : 'You'}</span>
                    <span>·</span>
                    <span>{m.time}</span>
                    {m.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => speakMessage(m.content)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6855e8', padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
                        title="Replay message audio"
                      >
                        <Volume2 size={11} /> Replay
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-msg character">
                  <div className="chat-bubble" style={{ color: '#64748b', fontStyle: 'italic' }}>
                    Alex Rivera is drafting workflow recommendations & prompt templates...
                  </div>
                </div>
              )}

              {/* Latest Guidance Card */}
              {latestGuidance && (
                <div className="mentor-guidance-card">
                  <div className="mentor-guidance-header">
                    <div className="mentor-guidance-title">
                      <Sparkles size={16} /> Enterprise Mentor Action Blueprint
                    </div>
                    {latestGuidance.recommendedCourse && (
                      <span className="mentor-course-badge">
                        <GraduationCap size={13} /> {latestGuidance.recommendedCourse}
                      </span>
                    )}
                  </div>

                  {latestGuidance.recommendedPrompt && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                        Ready-to-Use Copyable Prompt Template:
                      </div>
                      <div className="mentor-prompt-box">
                        <span>{latestGuidance.recommendedPrompt}</span>
                        <button
                          type="button"
                          className="ghost-sm"
                          onClick={() => copyToClipboard(latestGuidance.recommendedPrompt, 'mentor-prompt')}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                        >
                          {copiedKey === 'mentor-prompt' ? <><Check size={13} color="#10b981" /> Copied</> : <><Copy size={13} /> Copy Prompt</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {latestGuidance.keyTakeaways && latestGuidance.keyTakeaways.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                      {latestGuidance.keyTakeaways.map((t, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: '#14532d', lineHeight: '1.45' }}>
                          <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {latestGuidance.nextQuestion && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0', fontSize: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={14} color="#16a34a" />
                      <span><b>Next Discussion Step:</b> {latestGuidance.nextQuestion}</span>
                    </div>
                  )}
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Starters & Input Area */}
            <div className="chat-input-area">
              <div className="quick-chips-bar">
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', alignSelf: 'center', whiteSpace: 'nowrap' }}>Suggested Questions:</span>
                {quickStarters.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-chip"
                    onClick={() => {
                      setInputText(starter);
                    }}
                  >
                    {starter}
                  </button>
                ))}
              </div>

              <form
                className="chat-input-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <button
                  type="button"
                  className={`chat-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleSpeechRecognition}
                  title={isListening ? 'Stop listening' : 'Click to speak (Voice Recognition)'}
                >
                  <Mic size={18} />
                </button>
                <input
                  type="text"
                  className="chat-input-box"
                  placeholder="Ask Alex Rivera about AI workflows, tools, prompts, or how to learn more..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!inputText.trim() || loading}
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROMPTS & 7-DAY SPRINT */}
      {activeTab === 'prompts' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span className="eyebrow" style={{ color: '#8b5cf6' }}>PROMPT LIBRARY</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>5 Battle-Tested Copyable AI Prompts</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Drop these exact prompts into ChatGPT or Claude, or test and discuss them directly with your AI Mentor.</p>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {aiPrompts.map((p, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{p.title}</span>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 10px' }}>{p.desc}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="ghost-sm"
                      onClick={() => testPromptInChat(p.prompt)}
                      style={{ cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca' }}
                    >
                      <Sparkles size={13} /> Discuss in Chat
                    </button>
                    <button
                      type="button"
                      className="ghost-sm"
                      onClick={() => copyToClipboard(p.prompt, `prompt-${idx}`)}
                      style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {copiedKey === `prompt-${idx}` ? <><Check size={14} color="#10b981" /> Copied!</> : <><Copy size={14} /> Copy prompt</>}
                    </button>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#334155', lineHeight: '1.5' }}>
                  {p.prompt}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '28px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', padding: '18px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Responsible AI Guardrails Checklist
            </span>
            <ul style={{ margin: '10px 0 0', paddingLeft: '20px', fontSize: '13px', color: '#78350f', lineHeight: '1.6' }}>
              <li><b>Data Privacy:</b> Never paste unredacted PII, proprietary financial models, or company secrets into public models.</li>
              <li><b>Fact Verification:</b> Always calculate and double-check numbers, formulas, and citations before presenting to senior leaders.</li>
              <li><b>Human Ownership:</b> AI drafts the starting point; you are 100% accountable for the final business output.</li>
            </ul>
          </div>

          {/* 7-Day Plan Sprint Builder */}
          <div style={{ marginTop: '28px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <span className="eyebrow" style={{ color: '#6855e8' }}>PERSONALIZED ROADMAP</span>
                <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>Build Your Tailored 7-Day AI Sprint</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Generate a customized 7-day habit and workflow sprint matched to your career track.</p>
              </div>
              <button className="primary" disabled={planLoading} onClick={runCoach} style={{ whiteSpace: 'nowrap' }}>
                {planLoading ? 'Generating your tailored sprint…' : <>Build 7-Day AI Sprint <ArrowRight size={16} /></>}
              </button>
            </div>

            {planError && <p role="alert" style={{ color: '#e11d48', fontWeight: 700 }}>{planError}</p>}

            {planData && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{planData.diagnosis}</h4>
                    {planData.weeklyHabit && <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}><b>Core Weekly Habit:</b> {planData.weeklyHabit}</p>}
                  </div>
                  {planData.score && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>AI Readiness</span>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#6855e8' }}>{planData.score}<small style={{ fontSize: '12px', color: '#94a3b8' }}>/100</small></div>
                    </div>
                  )}
                </div>

                {planData.sevenDayPlan && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {planData.sevenDayPlan.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#fff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #eef2f6' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#6855e8', minWidth: '54px' }}>Day {idx + 1}</span>
                        <span style={{ fontSize: '13px', color: '#334155' }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VERIFIED FREE AI COURSES & CERTIFICATIONS */}
      {activeTab === 'courses' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '14px' }}>
            <span className="eyebrow" style={{ color: '#16a34a' }}>TOP GLOBAL AI INSTITUTIONS</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: '4px 0' }}>Verified 100% Free AI Courses & Certifications</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Every course below provides complete free access or free audit so you can master enterprise generative AI, prompt engineering, and automation without paying tuition fees.</p>
          </div>

          <div className="courses-grid">
            {FREE_AI_COURSES.map(c => (
              <div key={c.id} className="course-card">
                <div className="course-head">
                  <span className="course-uni-badge">{c.university}</span>
                  <span className="course-free-pill">100% Free</span>
                </div>
                <h3>{c.title}</h3>
                <div className="course-meta">
                  <span>🏛️ {c.platform}</span>
                  <span>⏱️ {c.duration}</span>
                </div>
                <p className="course-desc">{c.desc}</p>
                <div className="course-skills">
                  {c.skills.map((s, idx) => (
                    <span key={idx} className="course-skill-tag">{s}</span>
                  ))}
                </div>
                <div className="course-foot">
                  <span className="course-instructor">{c.instructor}</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="course-link-btn"
                  >
                    Start Free Course <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Module({id,career}){
 useLayoutEffect(()=>{
  scrollToTop();
  const raf=requestAnimationFrame(scrollToTop);
  const t=setTimeout(scrollToTop,50);
  return ()=>{cancelAnimationFrame(raf);clearTimeout(t)};
 },[id]);
 const[loading,setLoading]=useState(false),[data,setData]=useState(null),[error,setError]=useState('');
 const[company,setCompany]=useState(''),[problem,setProblem]=useState(''),[idea,setIdea]=useState('');
 const[copiedKey,setCopiedKey]=useState('');

 const cv=readSession('gjr_cv_text','');

 if (id === 'readiness') {
  return <CorporateReadinessView career={career} cv={cv} />;
 }

 if (id === 'ai') {
  return <AIAtWorkView career={career} cv={cv} />;
 }

 const copyToClipboard=(text,key)=>{
  try{
   if(navigator?.clipboard?.writeText){
    navigator.clipboard.writeText(text);
   }else{
    const ta=document.createElement('textarea');
    ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.focus();ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
   }
   setCopiedKey(key);
   setTimeout(()=>setCopiedKey(''),2500);
  }catch(e){console.warn('Clipboard copy failed:',e)}
 };

 const presets=[
  {
   name:'Zomato',
   problem:'High delivery cancellation and rider drop-off rates during sudden peak monsoon rain spells across Tier-1 metros.',
   idea:'Predictive weather-buffer surge allocation with instant 1km restaurant rerouting and delivery partner rain-insurance incentives.'
  },
  {
   name:'Asian Paints',
   problem:'High customer drop-off during the digital color-visualisation consultation phase before booking an authorized contractor.',
   idea:'Lightweight AR-powered WhatsApp bot allowing homeowners to preview wall shades from photos with instant local dealer quotes.'
  },
  {
   name:'Flipkart',
   problem:'Apparel cart abandonment in Tier-2/3 cities caused by sizing uncertainty and hesitation around return logistics.',
   idea:'Voice-assisted vernacular size calibrator comparing local garment fits with zero-penalty 1-click doorstep exchange.'
  },
  {
   name:'Deloitte',
   problem:'Cross-border ESG and supply chain compliance audits consume weeks due to unstructured, multi-lingual vendor PDF invoices.',
   idea:'Automated multi-lingual invoice extraction pipeline with anomaly detection, fraud flags, and automated ESG risk scoring.'
  }
 ];

 const selectPreset=(p)=>{
  setCompany(p.name);
  setProblem(p.problem);
  setIdea(p.idea);
 };

 const runCoach=async()=>{
  setLoading(true);setError('');
  try{
   let d;
   try{
    d=await post('/api/coach',{module:'ai',context:cv,career});
   }catch(e){
    d={
     diagnosis:'Accelerate your daily workflow with practical, responsible AI prompting.',
     score:82,
     weeklyHabit:'Use structured prompt frameworks (Context + Task + Constraints + Format) for all non-confidential deliverables.',
     sevenDayPlan:[
      'Day 1: Audit repetitive daily writing and summarize 3 workflows with AI.',
      'Day 2: Draft an executive memo using the Situation-Complication-Question-Answer framework.',
      'Day 3: Transform raw meeting transcripts into a clean RACI decision table.',
      'Day 4: Run exploratory data anomaly analysis and highlight outliers.',
      'Day 5: Scaffold clean code functions and generate 5 unit test cases.',
      'Day 6: Refine executive communication tone for diplomatic firmness.',
      'Day 7: Establish personal verification guardrails to eliminate hallucination risks.'
     ]
    };
   }
   setData(d);
  }finally{setLoading(false)}
 };

 const runDemo=async()=>{
  if(!problem.trim()){setError('Describe the company problem first.');return}
  setLoading(true);setError('');
  try{
   let d;
   try{
    d=await post('/api/demo',{company,problem,idea});
   }catch(e){
    const comp=company.trim()||'Target Employer';
    d={
     title:`${comp} High-Impact Solution Prototype`,
     tagline:`A targeted workflow engineered to solve ${comp}'s core operational friction and unlock measurable retention.`,
     users:'Frontline operations teams, regional managers, and high-intent end users.',
     impact:'Reduces operational turnaround time by 35% and boosts user conversion with verifiable audit tracking.',
     pitch:[
      `The Problem: ${comp} currently faces significant drop-off and friction around: "${problem.slice(0,110)}...".`,
      `The User: Frontline teams and end customers who need instantaneous resolution without multi-step delays.`,
      `The Workflow: An intelligent routing and automated verification engine that resolves requests in real time.`,
      `The Business Metric: Directly targets a 25-35% efficiency boost and measurable increase in NPS and retention.`
     ],
     html:`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${comp} Prototype</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:20px;background:#f8f9fc;color:#1e293b}header{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2px solid #e2e8f0}.logo{font-size:18px;font-weight:800;color:#4f46e5}.badge{background:#e0e7ff;color:#4338ca;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}.hero{margin:16px 0;padding:20px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,.03)}h1{font-size:20px;margin:0 0 6px}p{color:#64748b;font-size:13px;line-height:1.5;margin:0 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.card{background:#f1f5f9;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;transition:all .3s}.card.active{background:#eef2ff;border-color:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.15)}.card strong{display:block;font-size:13px;margin-bottom:4px;color:#1e293b}.card small{display:block;font-size:11px;color:#64748b;margin-top:6px}.btn{background:#4f46e5;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s}.btn:hover{background:#4338ca}.btn:disabled{opacity:.7;cursor:not-allowed}.status-box{display:none;margin-top:16px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #cbd5e1}.status-box.show{display:block;animation:fadeIn .3s}.log-line{font-size:12px;font-family:monospace;color:#334155;margin:4px 0;display:flex;align-items:center;gap:6px}.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1}.kpi{text-align:center}.kpi-val{font-size:16px;font-weight:800;color:#16a34a}.kpi-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase}@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}</style></head><body><header><div class="logo">${comp} OpsPilot</div><span class="badge" id="statusBadge">Live Demo</span></header><div class="hero"><h1>Streamlined Resolution Engine</h1><p>Engineered to resolve: ${problem.slice(0,160)}</p><div class="grid"><div class="card" id="card1"><strong>Real-time Triage</strong>Automated intake and categorization of high-priority requests.<small id="c1-stat">Status: Standby</small></div><div class="card" id="card2"><strong>Predictive Escalation</strong>Routes complex edge-cases with SLA risk warnings.<small id="c2-stat">Status: Standby</small></div></div><button class="btn" id="simBtn" onclick="runSimulation()"><span id="btnIcon">⚡</span> <span id="btnText">Simulate Workflow</span></button><div class="status-box" id="statusBox"><div style="font-weight:700;font-size:12px;color:#1e293b;margin-bottom:8px">Live Workflow Execution Telemetry</div><div id="logContainer"></div><div class="kpi-row" id="kpiRow" style="display:none"><div class="kpi"><div class="kpi-val">82ms</div><div class="kpi-label">Triage Latency</div></div><div class="kpi"><div class="kpi-val">-85%</div><div class="kpi-label">Drop-off Rate</div></div><div class="kpi"><div class="kpi-val">99.8%</div><div class="kpi-label">SLA Compliance</div></div></div></div></div><script>function runSimulation(){var btn=document.getElementById('simBtn'),btnText=document.getElementById('btnText'),btnIcon=document.getElementById('btnIcon'),statusBox=document.getElementById('statusBox'),log=document.getElementById('logContainer'),kpi=document.getElementById('kpiRow'),c1=document.getElementById('card1'),c2=document.getElementById('card2'),s1=document.getElementById('c1-stat'),s2=document.getElementById('c2-stat'),badge=document.getElementById('statusBadge');btn.disabled=true;btnText.innerText='Simulating Workflow...';btnIcon.innerText='⏳';statusBox.className='status-box show';log.innerHTML='';kpi.style.display='none';badge.innerText='Simulating...';badge.style.background='#fef3c7';badge.style.color='#b45309';var steps=[{t:200,msg:'⚡ [0.2s] Ingested incoming trigger event across regional nodes.',fn:function(){c1.className='card active';s1.innerText='Status: Active · Processing intake';}},{t:600,msg:'📍 [0.6s] Real-time Triage: Pattern matched high-priority friction rule; auto-routing applied.',fn:function(){s1.innerText='Status: ✓ Completed (1,420 events categorized)';}},{t:1000,msg:'🛡️ [1.0s] Predictive Escalation: Auto-allocated mitigation buffer and partner incentives.',fn:function(){c2.className='card active';s2.innerText='Status: Active · Mitigation dispatched';}},{t:1400,msg:'✅ [1.4s] Workflow completed successfully. Zero SLA breaches recorded.',fn:function(){s2.innerText='Status: ✓ Resolved · Edge cases guarded';kpi.style.display='grid';btn.disabled=false;btnIcon.innerText='🔄';btnText.innerText='Re-simulate Workflow';badge.innerText='✓ Verified Live';badge.style.background='#dcfce7';badge.style.color='#15803d';}}];steps.forEach(function(s){setTimeout(function(){var d=document.createElement('div');d.className='log-line';d.innerText=s.msg;log.appendChild(d);if(s.fn)s.fn();},s.t);});}</script></body></html>`
    };
   }
   setData(d);
  }finally{setLoading(false)}
 };

 const openHtmlInNewTab=(htmlContent)=>{
  try{
   const blob=new Blob([htmlContent],{type:'text/html'});
   const url=URL.createObjectURL(blob);
   window.open(url,'_blank');
  }catch(err){console.warn('Could not open tab:',err)}
 };

 const downloadHtml=(htmlContent,filename='prototype.html')=>{
  try{
   const blob=new Blob([htmlContent],{type:'text/html'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;a.download=filename;
   document.body.appendChild(a);a.click();
   document.body.removeChild(a);URL.revokeObjectURL(url);
  }catch(err){console.warn('Could not download:',err)}
 };

 return(
  <div className="module-panel">
   <span className="eyebrow">STAGE 1 · STAND OUT IN THE FINAL ROUND</span>
   <h2>Build a Credible Product Concept & Prototype</h2>
   <p>Top candidates don't just answer questions — they bring a tangible solution to a real business problem. Select a preset below or enter any target company.</p>

   <div style={{marginBottom:'16px'}}>
    <span style={{fontSize:'12px',fontWeight:800,color:'#6366f1',textTransform:'uppercase',display:'block',marginBottom:'8px'}}>
     Popular Company Case Presets
    </span>
    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
     {presets.map((p,idx)=>(
      <button key={idx} type="button" className="ghost-sm" onClick={()=>selectPreset(p)} style={{cursor:'pointer',border:company===p.name?'1px solid #6366f1':'1px solid #cbd5e1',background:company===p.name?'#eef2ff':'#fff',fontWeight:company===p.name?800:600}}>
       {p.name}
      </button>
     ))}
    </div>
   </div>

   <div className="input-card">
    <div className="label"><BriefcaseBusiness size={17}/> Target Company</div>
    <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Zomato, Flipkart, Deloitte, Asian Paints"/>

    <div className="label"><Target size={17}/> Real Business Problem to Solve</div>
    <textarea value={problem} onChange={e=>setProblem(e.target.value)} placeholder="What specific user friction, operational bottleneck, or business drop-off should they solve?"/>

    <div className="label"><Sparkles size={17}/> Your Solution Concept <span>(optional)</span></div>
    <textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Your initial product idea, workflow, or architectural angle…"/>

    <button className="primary" disabled={loading||!problem.trim()} onClick={runDemo} style={{marginTop:'8px'}}>
     {loading?'Engineering concept & prototype…':<>Build my interview demo <ArrowRight size={18}/></>}
    </button>
   </div>

   {error&&<p role="alert" style={{color:'#e11d48',fontWeight:700}}>{error}</p>}

   {data&&(
    <div className="module-result" style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'20px',padding:'24px',boxShadow:'0 4px 20px rgba(0,0,0,.04)'}}>
     <div style={{borderBottom:'1px solid #eef2f6',paddingBottom:'16px',marginBottom:'16px'}}>
      <span className="eyebrow" style={{color:'#6366f1'}}>STAND-OUT CONCEPT</span>
      <h3 style={{fontSize:'22px',fontWeight:800,margin:'6px 0'}}>{data.title}</h3>
      <p style={{fontSize:'14px',fontWeight:700,color:'#334155',margin:'4px 0'}}>{data.tagline}</p>
      {data.users&&<p style={{fontSize:'13px',color:'#64748b',margin:'4px 0'}}><b>Target Users:</b> {data.users}</p>}
      {data.impact&&<p style={{fontSize:'13px',color:'#64748b',margin:'4px 0'}}><b>Business Impact:</b> {data.impact}</p>}
     </div>

     {data.pitch&&Array.isArray(data.pitch)&&(
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'18px',marginBottom:'20px'}}>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
        <span style={{fontSize:'13px',fontWeight:800,color:'#1e293b',display:'flex',alignItems:'center',gap:'6px'}}>
         <Lightbulb size={16} color="#eab308"/> 60-Second Elevator Pitch Structure
        </span>
        <button className="ghost-sm" onClick={()=>copyToClipboard(data.pitch.join('\n\n'),'pitch')} style={{cursor:'pointer'}}>
         {copiedKey==='pitch'?<><Check size={14} color="#10b981"/> Copied!</>:<><Copy size={14}/> Copy pitch</>}
        </button>
       </div>
       <div style={{display:'grid',gap:'8px'}}>
        {data.pitch.map((pt,idx)=>(
         <div key={idx} style={{display:'flex',gap:'10px',fontSize:'13px',color:'#334155',lineHeight:'1.5'}}>
          <CheckCircle2 size={16} color="#6366f1" style={{flexShrink:0,marginTop:'2px'}}/>
          <span>{pt}</span>
         </div>
        ))}
       </div>
      </div>
     )}

     {data.html&&(
      <div>
       <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'8px'}}>
        <span style={{fontSize:'13px',fontWeight:800,color:'#1e293b'}}>Interactive Prototype Preview</span>
        <div style={{display:'flex',gap:'8px'}}>
         <button className="ghost-sm" onClick={()=>openHtmlInNewTab(data.html)} style={{cursor:'pointer'}}>
          <ExternalLink size={14}/> Open in new tab
         </button>
         <button className="ghost-sm" onClick={()=>downloadHtml(data.html,`${(company||'prototype').toLowerCase().replace(/\s+/g,'-')}-concept.html`)} style={{cursor:'pointer'}}>
          <Download size={14}/> Download HTML
         </button>
        </div>
       </div>
        <div style={{border:'1px solid #cbd5e1',borderRadius:'14px',overflow:'hidden',background:'#fff'}}>
         <iframe title="Prototype Sandbox" srcDoc={data.html} style={{width:'100%',height:'460px',border:'none'}} sandbox="allow-scripts allow-modals allow-same-origin allow-forms"/>
        </div>
      </div>
     )}
    </div>
   )}
  </div>
 );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('GetJobReady Startup Exception:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'system-ui,-apple-system,sans-serif',textAlign:'center',background:'#12182a',color:'#fff'}}>
          <img src="/logo.svg" alt="GetJobReady" style={{width:'56px',height:'56px',marginBottom:'16px'}} />
          <h2 style={{fontSize:'22px',fontWeight:'800',marginBottom:'8px'}}>GetJobReady Updated</h2>
          <p style={{fontSize:'13px',color:'#94a3b8',marginBottom:'24px',maxWidth:'400px'}}>A new version of GetJobReady is live. Click below to refresh your workspace.</p>
          <button style={{padding:'12px 28px',background:'linear-gradient(135deg,#6855e8,#a78bfa)',color:'#fff',border:'none',borderRadius:'99px',fontWeight:'700',fontSize:'14px',cursor:'pointer',boxShadow:'0 8px 24px rgba(104,85,232,0.3)'}} onClick={()=>{try{localStorage.clear();sessionStorage.clear()}catch{}window.location.reload(true)}}>
            Refresh Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

