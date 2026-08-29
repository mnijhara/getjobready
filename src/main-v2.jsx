import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{Upload,FileText,Target,Mic,ShieldCheck,Sparkles,ArrowRight,CheckCircle2,BriefcaseBusiness,ChevronRight,MessageSquareText,X,Headphones,Volume2,RefreshCw,Check,Folder,Plus}from'lucide-react';
import'./styles.css';import'./voice.css';import'./mode-tabs.css';
import { db } from './db.js';

const modules=[
{id:'resume',icon:FileText,title:'CV Preparation',text:'Review your CV, improve it, then practise with the final version.',tag:'Start here'},
{id:'interview',icon:Mic,title:'AI Audio Interview',text:'A real voice conversation with automatic capture and a visible transcript.',tag:'Practice'},
{id:'readiness',icon:ShieldCheck,title:'Corporate Ready',text:'Build communication, confidence, feedback and workplace habits.',tag:'Thrive'},
{id:'ai',icon:Sparkles,title:'AI at Work',text:'Learn practical AI workflows that make you faster and sharper.',tag:'Future-ready'},
{id:'demo',icon:Target,title:'Impress the Interviewer',text:'Turn a company problem into a polished product concept and demo.',tag:'Stand out'}
];

const fallback=mode=>({score:72,headline:mode==='general'?'Your CV has a solid base.':'Your profile has a solid base — now make it role-specific.',summary:'Strengthen evidence, clarity and outcomes before you interview.',highlights:['Clear academic foundation','Transferable problem-solving skills','Strong learning intent'],gaps:['Add measurable outcomes','Make ownership explicit','Connect your strongest evidence to the target role'],cvImprovements:['Lead bullets with action + outcome','Quantify scope only where your CV supports it','Move the strongest evidence higher'],rewrittenBullets:['Led a project using a structured approach to improve a measurable outcome.','Collaborated with a cross-functional team to deliver a project within the agreed timeline.'],plan:['Create a 90-second introduction','Strengthen your top three CV bullets','Build three STAR stories','Research the company and role','Practise five interview questions','Complete a realistic voice interview','Review feedback and repeat'],interviewQuestions:['Tell me about yourself and the experience you are most proud of.','Walk me through a project where you solved a difficult problem.','Tell me about a time you took ownership.','What is one piece of feedback that changed how you work?','What would you do in your first 30 days?']});

const readSession=(key,f='')=>{try{return sessionStorage.getItem(key)||f}catch{return f}};
const saveSession=(key,v)=>{try{sessionStorage.setItem(key,v)}catch{}};

async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data}

async function pdfText(file){
 try{
  const lib=await import('pdfjs-dist').catch(e=>{
   if(e?.message?.includes('dynamically imported module')||e?.name==='TypeError'){
    window.location.reload();
   }
   throw e;
  });
  const pdfjs=lib.default&&lib.default.getDocument?lib.default:lib;
  pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),disableWorker:true}).promise;
  let out='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const t=await p.getTextContent();out+=t.items.map(x=>x.str).join(' ')+'\n'}
  if(out.trim())return out.trim();
 }catch(err){
  console.warn('PDF.js parsing failed, trying text extraction fallback:',err);
  if(err?.message?.includes('dynamically imported module')||err?.name==='TypeError'){
   window.location.reload();
   return '';
  }
 }
 // Fallback text reader for unencrypted / simple PDFs
 try{
  const raw=await file.text();
  const clean=raw.replace(/[^\x20-\x7E\n\r\t]/g,' ').replace(/\s+/g,' ').trim();
  if(clean.length>40)return clean;
 }catch{}
 throw new Error('Could not extract text from this PDF file. Please paste your CV text into the text box below.');
}

async function docxText(file){
 try{
  const mammoth=await import('mammoth').catch(e=>{
   if(e?.message?.includes('dynamically imported module')){window.location.reload()}
   throw e;
  });
  const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
  return String(result.value||'').trim();
 }catch(e){
  throw new Error('Could not read this DOCX file. Please paste your text into the text box below.');
 }
}

async function readFile(file){
 if(file.type==='text/plain'||/\.txt$/i.test(file.name))return file.text();
 if(/\.pdf$/i.test(file.name))return pdfText(file);
 if(/\.docx$/i.test(file.name))return docxText(file);
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
  // Split on section headers (case-insensitive with flexible whitespace)
  .replace(/\s+(Education|Academic Background|Academics|Academic Details)\s+/gi,'\n\nEDUCATION\n')
  .replace(/\s+(Experience|Work Experience|Professional Experience|Internships)\s+/gi,'\n\nPROFESSIONAL EXPERIENCE\n')
  .replace(/\s+(Projects|Key Projects|Academic Projects|Personal Projects)\s+/gi,'\n\nKEY PROJECTS\n')
  .replace(/\s+(Technical Skills|Technical Expertise|Key Skills|Skills & Tools|Skills)\s+/gi,'\n\nTECHNICAL SKILLS\n')
  .replace(/\s+(Achievements|Honors & Awards|Awards|Competitive Programming)\s+/gi,'\n\nACHIEVEMENTS\n')
  .replace(/\s+(Leadership & Responsibility|Positions of Responsibility|Leadership|Extracurricular)\s+/gi,'\n\nLEADERSHIP\n')
  .replace(/\s+(Certifications|Certificates|Courses)\s+/gi,'\n\nCERTIFICATIONS\n')
  .replace(/(▪|•|◆|●|\*\s+)/g,'\n• ');

 return text.split('\n')
  .map(line=>line.trim())
  .filter(Boolean)
  .join('\n');
}


function generateTailoredCVQuestions(cvText,jd,role){
 const cv=cvText||'';
 const lines=cv.split('\n').map(l=>l.replace(/^[•\-▪*◆]\s*/,'').trim()).filter(Boolean);
 const companies=[];const bullets=[];
 lines.forEach(l=>{
  if(l.includes(' · ')||l.includes(' - ')){
   companies.push(l.split(' · ')[0]||l);
  }else if(l.length>35&&l.length<160&&!/(SUMMARY|COMPETENCIES|EXPERIENCE|EDUCATION|PROJECTS|SKILLS)/i.test(l)){
   bullets.push(l);
  }
 });

 const b1=bullets[0]||'your key achievements';
 const b2=bullets[1]||'a major project';
 const comp=companies[0]||'your previous organisation or project';
 const topContext=lines.slice(0,15).join(' ')+' '+(role||'')+' '+(jd||'');
 const domain=/\b(software|engineer|developer|coding|backend|frontend|fullstack|java|python|golang|go|react|node|c\+\+|computer science|b\.tech|btech|algorithms|git|cloud|aws|docker)\b/i.test(topContext)?'Technology'
  :/\b(marketing|brand|campaign|consumer|growth|advertising)\b/i.test(topContext)?'Marketing'
  :/\b(finance|banking|valuation|equity|portfolio|cfa|financial)\b/i.test(topContext)?'Finance'
  :/\b(human resources|hrbp|talent acquisition|recruitment|people ops)\b/i.test(topContext)?'Human Resources'
  :/\b(consulting|strategy|operations|business analyst)\b/i.test(topContext)?'Management Consulting'
  :(role||'your field');
 const isInternship=/(intern|summer|trainee|pgdm|mba|bcom|year|semester)/i.test(topContext);

 const q1=`Tell me about yourself — your background in ${domain}, your academic journey, and the one experience or project you're most proud of so far.`;
 const q2=`In your CV, you mention "${b1.slice(0,85)}" — walk me through the exact situation, your specific role, the actions you personally took, and the measurable result.`;
 const q3=isInternship
  ?`Tell me about your summer internship or key technical project. What was your day-to-day responsibility, what tools or AI did you use, and what's the one number that shows your impact?`
  :`Tell me about a major project at ${comp.slice(0,40)}. What was your personal ownership, what challenge did you face, and what was the quantifiable outcome?`;
 const q4=`How are you using AI tools — like ChatGPT, Claude, Copilot, or modern frameworks — in your work or studies? Give me a specific example where it made you faster or more effective.`;
 const q5=`Describe a time when something went wrong, a deadline was missed, or you faced a technical roadblock. How did you debug or resolve it and what would you do differently?`;
 const q6=`If you joined ${role?'the '+role+' team':'this team'} tomorrow, what's your 30-day plan to add real value, build relationships, and prove yourself quickly?`;

  return[q1,q2,q3,q4,q5,q6];
}

function evaluateInterviewTurnLocal(question,answer,history){
 const words=answer.trim().split(/\s+/).filter(Boolean);
 const wordCount=words.length;
 const isGibberish=/(^good\s*job$|^did\s*a?\s*good\s*job$|^okay$|^ok$|^fine$|^yes$|^no$|^hello$|^test$|^build\s*a\s*good\s*job$)/i.test(answer.trim());
 const isRepetitive=wordCount>4&&new Set(words).size<wordCount*0.4;
 let turnScore=0;let note='';

 if(wordCount<=3||isGibberish){
  turnScore=Math.round(Math.random()*6+4); // 4-10
  note='This answer is only ' + wordCount + ' word' + (wordCount===1?'':'s') + ' and lacks substantive content. In a real interview, this is an immediate rejection. Use the STAR method (Situation → Task → Action → Result) and speak for at least 45–60 seconds.';
 }else if(wordCount<12||isRepetitive){
  turnScore=Math.round(Math.random()*8+16); // 16-24
  note='Answer is too brief (' + wordCount + ' words). It describes a vague statement rather than a complete STAR story. Add details on what YOU personally built or delivered.';
 }else if(wordCount<25){
  turnScore=Math.round(Math.random()*10+32); // 32-42
  note='Decent start but lacks depth. Elaborate on the technical complexity, what obstacles you overcame, and add a specific measurable outcome.';
 }else if(!/(because|result|achieved|led|built|managed|increased|reduced|impact|percent|%|rs|cr|lakh|team|project|solved|completed|delivered|seconds|ms|users|scale)/i.test(answer)){
  turnScore=Math.round(Math.random()*10+48); // 48-58
  note='Good structure, but missing quantifiable impact. Recruiters look for numbers: percentage improvement, time saved, lines of code, or business metrics.';
 }else{
  turnScore=Math.min(95,Math.round(72+wordCount/4));
  note='Strong STAR response with clear personal ownership and measurable outcomes. Well articulated.';
 }

 // Generate a model answer based on the specific question type
 const q=question.toLowerCase();
 let modelAnswer='';
 const quoteMatch=question.match(/"([^"]+)"/);
 const quotedSnippet=quoteMatch?quoteMatch[1]:'';

 if(/tell me about yourself|background in technology|academic journey|proud of so far/i.test(q)){
  modelAnswer=`"I'm a final-year Computer Science student with a strong foundation in backend development, data structures, and cloud technologies. Over the past two years, I've built production-grade systems including API microservices and automated testing pipelines. The project I'm most proud of is an automated storage optimization tool that reduced cloud storage overhead by 35% across 10,000+ daily test files. I'm eager to bring my hands-on backend and problem-solving skills to this engineering team."`;
 }else if(/ai tools|chatgpt|claude|copilot|frameworks|faster or more effective/i.test(q)){
  modelAnswer=`"I use modern AI tools daily to accelerate development velocity and code quality. Specifically, I use GitHub Copilot to write unit test scaffolding and boilerplate algorithms, and Claude/ChatGPT to simulate edge cases and explain legacy stack error logs. For instance, when integrating Cloudflare R2 APIs, I used LLM prompts to quickly compare SDK caching strategies, saving roughly 4 hours of trial-and-error. I always manually review and write tests for any AI-assisted code to maintain strict security and performance standards."`;
 }else if(/went wrong|deadline was missed|roadblock|debug or resolve|what would you do differently/i.test(q)){
  modelAnswer=`"During a critical project milestone, an API endpoint began failing under concurrent load 48 hours before release. [Situation/Task] As the backend lead, I had to diagnose the bottleneck immediately without delaying the team. [Action] I used distributed tracing to locate an unindexed database query causing thread starvation, wrote an asynchronous worker to offload heavy jobs, and added rate-limiting middleware. [Result] We resolved the issue within 6 hours, stress-tested up to 5,000 concurrent requests with zero errors, and delivered on schedule. Going forward, I instituted automated load testing before every major release."`;
 }else if(/30-day plan|30 day|joined this team tomorrow|add real value|prove yourself/i.test(q)){
  modelAnswer=`"In my first 30 days, my priority is 30% learning, 40% execution, and 30% relationship building. In Week 1, I'll deep-dive into the codebase, understand the deployment pipelines, and set up 1-on-1s with my mentor and peers to align on expectations. By Week 2 and 3, I aim to resolve at least 2 backlog bugs and ship my first pull request to demonstrate reliable execution. By Day 30, I will document any friction points I noticed in onboarding and present a proactive roadmap for my next quarter deliverables."`;
 }else if(/in your cv|cloudflare|r2|batch storage/i.test(q)||quotedSnippet){
  modelAnswer=`"In my CV project involving batch storage optimization: [Situation] Our team faced high latency and rising storage costs when running automated test suites. [Task] I took full ownership of designing a scalable batch storage system using Cloudflare R2. [Action] I architected the storage pipeline with Hono.js microservices, wrote worker scripts to batch process test assets asynchronously, and implemented cache headers for fast retrieval. [Result] This reduced batch upload latency by 42% and cut monthly storage costs by 30% while scaling to handle 50,000+ test runs per week."`;
 }else if(/summer internship|key technical project|day-to-day responsibility|one number that shows your impact/i.test(q)){
  modelAnswer=`"During my summer internship as a Backend Developer: [Situation/Task] I was responsible for maintaining microservice endpoints and improving test automation speed. [Action] On a day-to-day basis, I developed REST APIs in Node.js, integrated Redis caching, and automated test result storage. [Result] The key number showing my impact was reducing end-to-end test execution time by 55%, enabling our engineering team to ship pull requests twice as fast every sprint."`;
 }else{
  modelAnswer=`"[Situation & Task] Outline the specific project, context, and problem you were assigned. [Action] Detail what YOU specifically coded, designed, or led — mention specific technologies and decisions. [Result] Conclude with quantifiable impact — percentages, performance gains, revenue, or hours saved."`;
 }

 const allTurns=[...history,{question,answer,evaluation:{score:turnScore,notes:note,modelAnswer}}];
 const avgScore=Math.round(allTurns.reduce((sum,t)=>sum+(t.evaluation?.score||5),0)/allTurns.length);

 const strengths=[];const improvements=[];
 if(avgScore<30){
  strengths.push('None identified — all submitted answers were under 10 words or generic placeholders.');
  improvements.push('All submitted answers were too brief or generic. A recruiter will reject these immediately.');
  improvements.push('Every answer must use the STAR method: Situation → Task → Action → Result.');
  improvements.push('Speak for 45–60 seconds per question, referencing specific projects and tech stacks from your CV.');
  improvements.push('Review the Model Answers below for each question to see what hiring managers look for.');
 }else if(avgScore<55){
  strengths.push('Attempted structured responses across key competencies');
  improvements.push('Quantify every outcome with numbers: %, time saved, user count, or team size.');
  improvements.push('Highlight YOUR individual ownership — use "I built", "I architected", "I resolved" instead of passive phrasing.');
  improvements.push('Demonstrate technical depth by naming specific frameworks, databases, and debugging tools.');
 }else if(avgScore<75){
  strengths.push('Clear communication with relevant technical context');
  strengths.push('Addressed core questions with structured STAR thinking');
  improvements.push('Sharpen metrics — add exact benchmark numbers and business impact.');
  improvements.push('Practice concise 60-second delivery to keep recruiters engaged.');
 }else{
  strengths.push('Exceptional STAR delivery with strong ownership verbs and quantified impact');
  strengths.push('Demonstrated deep technical mastery and clear business thinking');
  improvements.push('Refine for executive-level 45-second elevator pitch speed.');
 }


 return{
  done:allTurns.length>=6,
  evaluation:{score:turnScore,notes:note,modelAnswer},
  finalFeedback:{
   score:avgScore,
   strengths,
   improvements,
   nextAction:avgScore>=75?'Ready for recruiter rounds! Practice 1 more role-specific JD.':avgScore>=50?'Repeat with structured 45-second STAR answers using examples from your CV.':'Review the Model Answers below and practise again with real STAR answers from your CV.'
  }
 };
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

function Dashboard({profile,onLogout,onNewApp,onOpen,onMasterCV,onEditCV,onInterview}){
 const[apps,setApps]=useState([]);const[interviews,setInterviews]=useState([]);const[tab,setTab]=useState('apps');
 useEffect(()=>{setApps(db.getApplications());setInterviews(db.getInterviews())},[]);
 const del=id=>{if(!confirm('Delete this application?'))return;db.deleteApplication(id);setApps(db.getApplications())};
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
   {interviews.map(iv=><div key={iv.id} className="input-card history-card">
    <div className="label"><Mic size={17}/> {iv.role||'General Interview'} <span className="sub">· {new Date(iv.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span></div>
    <p><strong>Score:</strong> <span style={{color:iv.score>=70?'#22c55e':'#f59e0b'}}>{iv.score||'—'}/100</span></p>
    {iv.strengths?.length>0&&<p className="sub">✓ {iv.strengths[0]}</p>}
    {iv.nextAction&&<p className="sub">→ {iv.nextAction}</p>}
   </div>)}
  </div>}
 </div>
}


function App(){
 const[screen,setScreen]=useState('home'),[career,setCareer]=useState(()=>readSession('gjr_career','job')), [prep,setPrep]=useState(()=>readSession('gjr_cv_mode','general'));
 const[cv,setCv]=useState(()=>readSession('gjr_cv_text','')), [jd,setJd]=useState(()=>readSession('gjr_jd_text','')),[cvFile,setCvFile]=useState(null),[jdFile,setJdFile]=useState(null);
 const[loading,setLoading]=useState(false),[result,setResult]=useState(null),[qIndex,setQIndex]=useState(0),[answers,setAnswers]=useState([]);
 const[profile,setProfile]=useState(()=>db.getProfile()),[appId,setAppId]=useState(null),[roleName,setRoleName]=useState(''),[showRoleModal,setShowRoleModal]=useState(false);
 const[masterSaved,setMasterSaved]=useState(false);
 const questions=useMemo(()=>result?.interviewQuestions?.length?result.interviewQuestions:generateTailoredCVQuestions(cv,jd,roleName),[result,cv,jd,roleName]);
 const handleLogin=email=>{db.saveProfile(email);setProfile({email});setCv(db.getMasterCV());setJd('');setAppId(null);setRoleName('');setScreen('home')};
 const handleLogout=()=>{db.logout();setProfile(null);setCv('');setJd('');setAppId(null);setRoleName('');setScreen('home')};
 const promptNewApp=()=>{setRoleName('');setShowRoleModal(true)};
 // New Application: ALWAYS go to resume screen with specific/JD mode when master exists
 const confirmNewApp=name=>{const id=Date.now().toString();setAppId(id);setRoleName(name||'General');const masterCV=db.getMasterCV();setCv(masterCV);setJd('');setCvFile(null);setJdFile(null);const mode=masterCV?'specific':'general';setPrep(mode);saveSession('gjr_cv_mode',mode);setShowRoleModal(false);setScreen('resume')};
 // Open app → go straight to cvstudio
 const openApp=a=>{setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setPrep(a.jd?'specific':'general');setResult(a.result||null);setScreen('cvstudio')};
 // Edit CV for a specific app
 const editCV=a=>{setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setPrep(a.jd?'specific':'general');setResult(a.result||null);setScreen('cvstudio')};
 // Start interview directly for a specific app (skip CV studio)
 const directInterview=a=>{setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setResult(a.result||null);setQIndex(0);setAnswers([]);setScreen('interview')};
 const openMasterCV=()=>{const masterCV=db.getMasterCV();setAppId('master');setCv(masterCV);setJd('');setPrep('general');setResult(null);setMasterSaved(false);setScreen('resume')};
 const choosePrep=m=>{setPrep(m);saveSession('gjr_cv_mode',m);setScreen('resume')};
 const changeCareer=v=>{setCareer(v);saveSession('gjr_career',v)};
 const parseFile=async(kind,file)=>{if(!file)return;const ok=kind==='cv'?/\.(pdf|txt|docx)$/i.test(file.name):/\.(pdf|txt)$/i.test(file.name);if(!ok){alert(kind==='cv'?'Please upload a PDF, DOCX or TXT CV.':'Please upload a PDF or TXT job description.');return}try{const text=await readFile(file);if(!text||!text.trim())throw new Error('The file contains no readable text. Please paste the text into the text box below.');if(kind==='cv'){const cleaned=cleanExtractedCVText(text);setCvFile(file);setCv(cleaned);saveSession('gjr_cv_text',cleaned)}else{setJdFile(file);setJd(text);saveSession('gjr_jd_text',text)}}catch(e){console.error('File parse exception:',e);if(e?.message?.includes('dynamically imported module')||e?.name==='TypeError'){window.location.reload();return}alert(e.message||'We could not read that file. Please paste your text into the box instead.')}};
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
   
   const targetId=appId||Date.now().toString();
   setAppId(targetId);
   if(!db.getMasterCV()){
    db.saveMasterCV(cv);
   }
   if(profile){
    db.saveApplication({id:targetId,role:roleName||(prep==='general'?'General CV':(jd.slice(0,30)+'…')),cv,score:data?.score,jd,result:data});
   }
   setScreen('cvstudio');
  }finally{
   setLoading(false);
  }
 };
 const saveFinal=text=>{
  setCv(text);
  saveSession('gjr_cv_ready','1');saveSession('gjr_cv_improved',text);saveSession('gjr_cv_text',text);
  const targetId=appId||Date.now().toString();
  setAppId(targetId);
  if(appId==='master'){
   db.saveMasterCV(text);
  }else if(profile){
   db.saveApplication({id:targetId,role:roleName||(prep==='general'?'General CV':'Custom Application'),cv:text,score:result?.score,jd,result});
  }
 };

 const startInterview=text=>{if(text)setCv(text);setQIndex(0);setAnswers([]);setScreen('interview')};
 const saveInterviewResult=d=>{
  const fb=d||{score:10,strengths:['You completed all questions'],improvements:['Use the STAR method for every answer','Give at least 30-60 seconds per answer','Quantify every result with a number'],nextAction:'Start over with real STAR answers using examples from your CV.'};
  if(profile){db.saveInterview({role:roleName||'General Interview',score:fb.score,strengths:fb.strengths,nextAction:fb.nextAction,appId});db.saveApplication({id:appId,role:roleName||'General CV',cv,score:result?.score,jd,result,interviewScore:fb.score})}
  setResult(r=>({...r,feedback:fb}));setScreen('feedback');
 };
 const goHome=()=>setScreen('home');
 if(screen==='home'){if(profile)return <Workspace title="My Workspace" subtitle="Your preparation hub." icon={<Folder/>} onHome={goHome}><Dashboard profile={profile} onLogout={handleLogout} onNewApp={promptNewApp} onOpen={openApp} onMasterCV={openMasterCV} onEditCV={editCV} onInterview={directInterview}/>{showRoleModal&&<div className="modal" onClick={e=>e.target===e.currentTarget&&setShowRoleModal(false)}><div className="modal-card login-card"><span className="eyebrow">NEW JOB APPLICATION</span><h2>Which role are you applying for?</h2><p>Give it a name — your Master CV will be pre-loaded and you can add the job description on the next screen.</p><input type="text" className="login-input" placeholder="e.g. Deloitte – Management Consulting Intern" value={roleName} onChange={e=>setRoleName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmNewApp(roleName)} autoFocus/><div style={{display:'flex',gap:'12px',justifyContent:'center'}}><button className="ghost-sm" onClick={()=>setShowRoleModal(false)}>Cancel</button><button className="primary" onClick={()=>confirmNewApp(roleName)}>Create <ArrowRight size={16}/></button></div></div></div>}</Workspace>;return <Home career={career}setCareer={changeCareer}choosePrep={choosePrep}openModule={setScreen}onLogin={handleLogin}/>}
 if(screen==='resume')return <Workspace title={prep==='general'?'General CV Preparation':'CV + Job Description'} subtitle={prep==='general'?'Review your CV without a target role. Save the final version before interviewing.':'Upload your CV and one specific JD. Improve the CV before you practise the role-specific interview.'} icon={<FileText/>} back={()=>setScreen('home')} onHome={goHome}><Prep prep={prep}setPrep={setPrep}cv={cv}setCv={setCv}jd={jd}setJd={setJd}cvFile={cvFile}jdFile={jdFile}parseFile={parseFile}clearFile={clearFile}analyze={analyze}loading={loading}/></Workspace>;
 if(screen==='cvstudio')return <Workspace title="Improve your CV first" subtitle={prep==='general'?'Review, edit and save your CV. Your interview will use the final version.':'Make your CV stronger for this role before you practise the interview.'} icon={<Sparkles/>} back={()=>setScreen('resume')} onHome={goHome}><CVStudio result={result||fallback(prep)}initial={cv}jd={jd}mode={prep}onSave={saveFinal}onContinue={startInterview}/></Workspace>;


 if(screen==='interview'){
  const totalQs=questions.length||6;
  const isLastTurn=qIndex>=totalQs-1;
  return <Workspace title="AI Audio Interview" compact back={()=>setScreen('cvstudio')} onHome={goHome}><VoiceInterview cv={cv}jd={jd}mode={prep}career={career}roleName={roleName}question={questions[Math.min(qIndex,totalQs-1)]}turn={qIndex+1}maxTurns={totalQs}history={answers}onTurn={(d,a)=>{const newAnswers=[...answers,{question:questions[qIndex],answer:a,evaluation:d?.evaluation}];setAnswers(newAnswers);const nextIdx=qIndex+1;if(nextIdx>=totalQs||d.done){saveInterviewResult(d.finalFeedback);}else{setQIndex(nextIdx);}}}onDone={saveInterviewResult}/></Workspace>;
 }




 if(screen==='feedback')return <Workspace title="Interview Feedback" subtitle="Your transcript, strengths and next actions." icon={<MessageSquareText/>} back={()=>setScreen('home')} onHome={goHome}><Feedback data={result?.feedback} answers={answers} onSyncSpokenWins={bullets=>{setCv(prev=>prev+'\n\n'+bullets);saveSession('gjr_cv_text',cv+'\n\n'+bullets);if(profile)db.saveApplication({id:appId,role:roleName||'General CV',cv:cv+'\n\n'+bullets,score:result?.score,jd,result})}} onHome={goHome} onPractiseAgain={()=>{setAnswers([]);setQIndex(0);setScreen('interview')}}/></Workspace>;

 return <Workspace title={modules.find(x=>x.id===screen)?.title||'GetJobReady'} subtitle={modules.find(x=>x.id===screen)?.text||''} icon={<Sparkles/>} back={()=>setScreen('home')} onHome={goHome}><Module id={screen}career={career}/></Workspace>
}

function Header({onHow,back,onHome}){return <header><div className="header-left">{back&&<button className="back"onClick={back}>← Back</button>}</div><button className="brand"onClick={onHome}style={{background:'none',border:'none',padding:0,cursor:onHome?'pointer':'default'}}><img src="/logo.svg" alt="GetJobReady Logo" style={{width:'42px',height:'42px',borderRadius:'14px',objectFit:'contain',display:'block'}} /><span>GetJobReady<span className="dot">.online</span></span></button>{onHow?<button className="ghost"onClick={onHow}><Sparkles size={15}/> How it works</button>:<div className="header-spacer"/>}</header>}


function Home({career,setCareer,choosePrep,openModule,onLogin}){const[how,setHow]=useState(false),[showLogin,setShowLogin]=useState(false),[email,setEmail]=useState('');return <div className="app"><Header onHow={()=>setHow(true)}/><main className="hero"><div><span className="trust-badge"><Sparkles size={13}/> Trusted by students at IIMs, ISBs &amp; top B-schools</span></div><div className="eyebrow">{career==='internship'?'INTERNSHIP TRACK':'FULL-TIME TRACK'} · AI-POWERED CAREER READINESS</div><h1>Your degree got you here.<br/><em>Let's get you hired.</em></h1><p className="lead">{career==='internship'?'Build a strong campus story, sharpen your CV and practise with a real AI voice interviewer before the big day.':'Improve your CV for the exact role, then practise a hands-free AI interview that adapts to your answers.'}</p><div className="career-toggle"><button className={career==='internship'?'active':''}onClick={()=>setCareer('internship')}>☀️ Internship</button><button className={career==='job'?'active':''}onClick={()=>setCareer('job')}>💼 Full-time</button></div><button className="primary hero-btn"onClick={()=>setShowLogin(true)}>Enter Workspace <ArrowRight size={18}/></button><div className="hero-stats"><div className="stat"><span className="stat-num">4</span><span className="stat-label">Prep Steps</span></div><div className="stat"><span className="stat-num">100%</span><span className="stat-label">Voice-powered</span></div><div className="stat"><span className="stat-num">Free</span><span className="stat-label">No sign-up</span></div></div><div className="proof"><span><CheckCircle2 size={16}/> CV review before interview</span><span><CheckCircle2 size={16}/> Hands-free voice interview</span><span><CheckCircle2 size={16}/> Instant feedback &amp; transcript</span></div></main><section className="module-grid">{modules.map(m=><button className="module-card"key={m.id}onClick={()=>m.id==='resume'?setShowLogin(true):m.id==='interview'?setShowLogin(true):openModule(m.id)}><div className="module-top"><span className="module-icon"><m.icon size={21}/></span><span className="pill">{m.tag}</span></div><h3>{m.title}</h3><p>{m.text}</p><span className="card-link">{m.id==='interview'?'Start with your CV':'Open'} <ChevronRight size={16}/></span></button>)}</section><section className="roadmap"><div><span className="eyebrow">THE JOURNEY</span><h2>Prepare → practise → improve.</h2></div><div className="steps"><div><b>01</b><span>Prepare</span><small>CV review + editor</small></div><div><b>02</b><span>Practise</span><small>Hands-free voice</small></div><div><b>03</b><span>Improve</span><small>Transcript + feedback</small></div></div></section><footer>Built for students entering their first internship or corporate role.</footer>{how&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setHow(false)}><div className="modal-card"><button className="modal-x"onClick={()=>setHow(false)}><X size={18}/></button><span className="eyebrow">HOW GETJOBREADY WORKS</span><h2>Prepare → practise → improve.</h2><div className="how-steps"><div><b>01</b><strong>Upload your CV</strong><span>Use General CV mode or add one specific JD.</span></div><div><b>02</b><strong>Improve before interviewing</strong><span>AI reviews your CV and gives you an editable version. If AI is temporarily unavailable, the CV studio still opens with a useful local review.</span></div><div><b>03</b><strong>Have a real voice interview</strong><span>AI asks the question aloud, then your answer is captured into the live transcript automatically.</span></div><div><b>04</b><strong>Get adaptive feedback</strong><span>Review your transcript, strengths and next actions.</span></div></div><button className="primary wide"onClick={()=>{setHow(false);setShowLogin(true)}}>Enter Workspace <ArrowRight size={18}/></button></div></div>}{showLogin&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setShowLogin(false)}><div className="modal-card login-card"><button className="modal-x"onClick={()=>setShowLogin(false)}><X size={18}/></button><span className="eyebrow">ACCESS WORKSPACE</span><h2>Enter your email</h2><p>We'll save your CVs and interview history securely on your device.</p><input type="email"className="login-input"placeholder="student@university.edu"value={email}onChange={e=>setEmail(e.target.value)}onKeyDown={e=>e.key==='Enter'&&email.includes('@')&&onLogin(email)}/><button className="primary wide"onClick={()=>{if(email.includes('@'))onLogin(email);else alert('Please enter a valid email.')}}>Continue <ArrowRight size={18}/></button></div></div>}</div>}

function Workspace({title,subtitle,icon,back,onHome,children,compact}){return <div className="app"><Header back={back} onHome={onHome}/><main className={compact?'workspace workspace-compact':'workspace'}>{!compact&&<div className="workspace-head"><span className="big-icon">{icon}</span><div><div className="eyebrow">YOUR PREPARATION</div><h1>{title}</h1><p>{subtitle}</p></div></div>}{children}</main></div>}

function Prep({prep,setPrep,cv,setCv,jd,setJd,cvFile,jdFile,parseFile,clearFile,analyze,loading}){
 const presets=[
  {label:'Deloitte · Consulting',jd:'Management Consulting Associate: Conduct business analysis, process optimization, stakeholder management, client presentations and quantitative problem solving. Require strong analytical thinking, structured communication (STAR format), leadership experience and project management.'},
  {label:'ICICI Bank · Finance',jd:'Financial Analyst / Relationship Manager: Portfolio analysis, financial modeling, credit risk assessment, DCF valuation, key client relations and market research. Require financial acumen, quantitative skills and strong interpersonal communication.'},
  {label:'Asian Paints · Marketing',jd:'Brand Management Trainee: Market segmentation, consumer insights, digital campaign ROI, competitive positioning, channel strategy and product launches. Require strategic thinking, creative problem solving and data-driven marketing decisions.'},
  {label:'Amazon · Analytics',jd:'Business & Product Analyst: SQL/Data analysis, metric tracking, user funnel optimization, cross-functional collaboration and customer-centric problem solving. Require structured problem solving, quantitative storytelling and bias for action.'}
 ];
 const applyPreset=p=>{setJd(p.jd);saveSession('gjr_jd_text',p.jd)};
 return <><div className="mode-switch"role="tablist"><button className={prep==='general'?'selected':''}onClick={()=>setPrep('general')}><span>📄</span><b>General CV</b>{prep==='general'&&<Check size={16}/>}</button><button className={prep==='specific'?'selected':''}onClick={()=>setPrep('specific')}><span>🎯</span><b>CV + specific JD</b>{prep==='specific'&&<Check size={16}/>}</button></div><div className="form-grid"><div className="input-card"><div className="label"><FileText size={17}/> Your CV</div><label className="dropzone"><Upload size={27}/><b>{cvFile?.name||'Upload your CV'}</b><span>{cvFile?'CV loaded · ready for review':'PDF, DOCX or TXT · or paste below'}</span><input type="file"accept=".pdf,.txt,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"onChange={e=>parseFile('cv',e.target.files?.[0])}/></label>{cvFile&&<button className="clear-file"onClick={()=>clearFile('cv')}><X size={15}/> Remove file</button>}<div className="or"><span>or paste CV text</span></div><textarea value={cv}onChange={e=>{setCv(e.target.value);saveSession('gjr_cv_text',e.target.value)}}placeholder="Paste your CV here…"/></div>{prep==='specific'?<div className="input-card"><div className="label"><BriefcaseBusiness size={17}/> Target Job Description</div><div className="preset-container"><span className="preset-title">⚡ Campus Placement Presets:</span><div className="preset-bar">{presets.map(p=><button key={p.label}className="preset-pill"type="button"onClick={()=>applyPreset(p)}>+ {p.label}</button>)}</div></div><label className="dropzone"><Upload size={27}/><b>{jdFile?.name||'Upload the job description'}</b><span>{jdFile?'JD loaded · role matching ready':'PDF or TXT · or paste below'}</span><input type="file"accept=".pdf,.txt,application/pdf,text/plain"onChange={e=>parseFile('jd',e.target.files?.[0])}/></label>{jdFile&&<button className="clear-file"onClick={()=>clearFile('jd')}><X size={15}/> Remove JD</button>}<div className="or"><span>or paste JD text</span></div><textarea className="tall"value={jd}onChange={e=>{setJd(e.target.value);saveSession('gjr_jd_text',e.target.value)}}placeholder="Paste the target job description or choose a campus recruiter preset above…"/></div>:<div className="input-card mode-explainer"><div className="label"><Sparkles size={17}/> General CV mode</div><div className="module-hero"><span className="eyebrow">CV ONLY</span><h2>No JD needed.</h2><p>Your CV is analysed on its own. You will edit and save the version you want the AI interviewer to use.</p></div></div>}<div className="full action-row"><div><b>{prep==='general'?'Ready to improve your CV?':'Ready to improve and match your CV?'}</b><span>Nothing sends you straight to interview. CV review always comes first.</span></div><button className="primary"disabled={loading||!cv.trim()||prep==='specific'&&!jd.trim()}onClick={analyze}>{loading?'Reviewing your CV…':<>Review & improve my CV <ArrowRight size={18}/></>}</button></div></div></>
}

/* ─── CV ENGINE ─────────────────────────────────────────────── */
function parseCV(raw){
 const text=cleanExtractedCVText(raw||'');
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);

 let name='',title='',contact='';

 const firstLine=lines[0]||'';

 // 1. Extract name from top line (before pipe '|', '+', email, or role titles)
 const emailMatch=firstLine.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
 const email=emailMatch?emailMatch[0]:'';
 const phoneMatch=firstLine.match(/\+?\d[\d\s\-]{8,}\d/);
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


 // 3. Build clean contact line
 const contactParts=[];
 if(phone)contactParts.push(phone);
 if(email)contactParts.push(email);
 if(/LinkedIn/i.test(firstLine))contactParts.push('LinkedIn');
 if(/GitHub/i.test(firstLine))contactParts.push('GitHub');
 if(/LeetCode/i.test(firstLine))contactParts.push('LeetCode');
 if(/CodeChef/i.test(firstLine))contactParts.push('CodeChef');
 if(/Codeforces/i.test(firstLine))contactParts.push('Codeforces');
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
  if(/(EXECUTIVE SUMMARY|PROFESSIONAL SUMMARY|SUMMARY|PROFILE|OBJECTIVE|ABOUT ME)/i.test(l)&&l.length<40){finishBlock();currentSection='summary';return}
  if(/(CORE COMPETENCIES|TECHNICAL SKILLS|SKILLS & TOOLS|KEY SKILLS|SKILLS|TECHNOLOGIES|COURSEWORK)/i.test(l)&&l.length<40){finishBlock();currentSection='competencies';return}
  if(/(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|INTERNSHIPS|EMPLOYMENT)/i.test(l)&&l.length<40){finishBlock();currentSection='experience';return}
  if(/(KEY PROJECTS|PROJECTS|ACADEMIC PROJECTS|PERSONAL PROJECTS)/i.test(l)&&l.length<40){finishBlock();currentSection='projects';return}
  if(/(EDUCATION|ACADEMIC BACKGROUND|ACADEMIC DETAILS|ACADEMICS)/i.test(l)&&l.length<40){finishBlock();currentSection='education';return}
  if(/(CERTIFICATIONS|COURSES|TRAINING|LICENSES)/i.test(l)&&l.length<40){finishBlock();currentSection='certifications';return}
  if(/(ACHIEVEMENTS|HONORS|AWARDS|COMPETITIVE PROGRAMMING)/i.test(l)&&l.length<40){finishBlock();currentSection='achievements';return}
  if(/(LEADERSHIP & RESPONSIBILITY|LEADERSHIP|POSITIONS OF RESPONSIBILITY|VOLUNTEERING)/i.test(l)&&l.length<40){finishBlock();currentSection='leadership';return}

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
    const parts=l.split(/\s+[·|]\s+/);
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

 // Strict domain detection
 const domain=/\b(software|engineer|developer|coding|backend|frontend|fullstack|java|python|golang|go|react|node|c\+\+|computer science|b\.tech|btech|algorithms|git|cloud|aws|docker)\b/i.test(allText)?'Technology'
  :/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(allText)?'HR'
  :/\b(finance|banking|valuation|equity|portfolio|cfa|financial analyst)\b/i.test(allText)?'Finance'
  :/\b(marketing|brand management|campaign|digital marketing|consumer insights)\b/i.test(allText)?'Marketing'
  :'General';

 const firstExp=sections.experience[0]||sections.projects[0];
 const firstCompany=firstExp?.company||firstExp?.role||'your key role';
 const firstRole=firstExp?.role||'Software Engineer';
 const allBullets=[...sections.experience.flatMap(e=>e.bullets),...sections.projects.flatMap(p=>p.bullets)];
 const yearsMatch=allText.match(/(\d+)\s*(\+?\s*)year/i);
 const yearsExp=yearsMatch?parseInt(yearsMatch[1]):null;

 // 1. Executive Summary
 if(!sections.summary.length){
  const sumExample=domain==='Technology'
   ?`Software Engineer with strong foundation in distributed systems, REST APIs, and scalable web architecture. Proven track record solving 800+ algorithmic problems and delivering production-ready applications.`
   :domain==='HR'
   ?`${yearsExp?yearsExp+'+ years of':''} experience in talent acquisition, HRBP, and organisational development. Proven track record building high-performance teams and reducing attrition.`
   :domain==='Finance'
   ?`Finance professional with strong analytical skills in financial modelling, credit analysis, and stakeholder management. Consistent track record of data-driven decision-making.`
   :domain==='Marketing'
   ?`Marketing professional specialising in brand management, consumer insights, and digital campaigns. Experience translating data into actionable growth strategies.`
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
  const compExamples=domain==='Technology'?'Data Structures & Algorithms · System Design · Go / React · REST APIs & WebSockets · SQL / NoSQL · Docker & Cloud'
   :domain==='HR'?'Talent Acquisition · HRBP · Org Design · Change Management · Employee Engagement · People Analytics'
   :domain==='Finance'?'Financial Modelling · Credit Analysis · DCF Valuation · Risk Assessment · Stakeholder Management · Excel/SQL'
   :domain==='Marketing'?'Brand Management · Consumer Insights · Digital Marketing · Campaign ROI · Market Research · Content Strategy'
   :'Data Analysis · Problem Solving · Stakeholder Communication · Project Management · Critical Thinking · Presentation';
  sugg.push({id:id++,type:'add_competencies',section:'CORE COMPETENCIES',icon:'⚡',label:`Expand Core Competencies — you have only ${sections.competencies.length}, recruiters expect 6–9`,preview:compExamples,checked:true});
 }

 // 3. AI / modern tools
 if(!/ai|chatgpt|claude|copilot|llm|analytics|docker/i.test(allText)){
  const aiExample=domain==='Technology'
   ?`Integrated LLM-driven APIs and automated prompt pipelines with strict schema validation to accelerate feature delivery.`
   :domain==='HR'
   ?`Used AI-powered ATS analytics and ChatGPT to screen 500+ applications, reducing time-to-hire by 28% and improving quality-of-hire scores.`
   :`Leveraged AI research tools (ChatGPT, Claude) to automate workflows and accelerate project delivery by 35%.`;
  sugg.push({id:id++,type:'add_bullet',section:'PROFESSIONAL EXPERIENCE',icon:'🤖',label:'Add AI & modern tools usage to your CV',preview:aiExample,checked:true});
 }

 // 4. Unquantified bullets
 const unquantified=allBullets.filter(b=>!/\d/.test(b)&&b.length>20).slice(0,2);
 unquantified.forEach((b,i)=>{
  const verb=b.match(/^(managed|led|handled|drove|supported|assisted|coordinated|engineered|designed|built)/i)?.[0]||'Led';
  sugg.push({id:id++,type:'quantify_bullet',section:'PROFESSIONAL EXPERIENCE',icon:'📊',label:`Quantify: "${b.slice(0,50)}..." — add a number`,preview:`${verb} [X% speedup / 100% uptime / X+ users / X-ms latency]. Add the exact metric that proves impact.`,checked:i===0});
 });

 // 5. Certifications
 if(!sections.certifications.length){
  const certExamples=domain==='Technology'?'AWS Certified Cloud Practitioner · Docker & Kubernetes Fundamentals · Google AI Essentials'
   :domain==='HR'?'SHRM Certified Professional · LinkedIn Learning: People Analytics · Google AI Essentials'
   :domain==='Finance'?'CFA Level I / Bloomberg Market Concepts · Google AI Essentials · Excel Modeling Certification'
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

 // Leadership
 if(sections.leadership?.length){
  body+=`<div class="section"><h2>L E A D E R S H I P &nbsp; &amp; &nbsp; R E S P O N S I B I L I T Y</h2>`;
  sections.leadership.forEach(l=>{
   if(l.bullets?.length){body+=`<ul>${l.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`}
   else if(l.role){body+=`<p class="edu-line">${l.role}</p>`}
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
function CVStudio({result,initial,mode,jd,isMasterCV,onSave,onContinue,onGoHome}){
 const[parsed,setParsed]=useState(()=>parseCV(String(initial||'')));
 const[suggestions,setSuggestions]=useState(()=>generateSuggestions(parseCV(String(initial||'')),jd||''));
 const[checked,setChecked]=useState(()=>{
  const s=generateSuggestions(parseCV(String(initial||'')),jd||'');
  return new Set(s.filter(x=>x.checked).map(x=>x.id));
 });
 const[applied,setApplied]=useState(false);
 const[builtCV,setBuiltCV]=useState(null);
 const[showEdit,setShowEdit]=useState(false);
 const[editText,setEditText]=useState(()=>cleanExtractedCVText(String(initial||'')));
 const[previewKey,setPreviewKey]=useState(0);

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
    <div className="continue-card">
     {isMasterCV
      ?<><div><b>✅ Master CV saved!</b><span>Now create job-specific applications and add each JD to practise a tailored interview.</span></div>
        <button className="primary" onClick={()=>{onSave(editText);onGoHome&&onGoHome()}}>Go to My Applications <ArrowRight size={18}/></button></>
      :<><div><b>Next: live interview</b><span>Your improved CV will be used by the AI interviewer for this role.</span></div>
        <button className="primary" onClick={()=>{onSave(editText);onContinue(editText)}}>Save &amp; start interview <ArrowRight size={18}/></button></>
     }
    </div>
   </div>
  </div>
 </div>
}


function VoiceInterview({cv,jd,mode,career,roleName,question,turn,maxTurns,history,onTurn,onDone}){

 const[status,setStatus]=useState('starting'),[transcript,setTranscript]=useState(''),[turns,setTurns]=useState(history||[]),[permission,setPermission]=useState(false);
 const rec=useRef(null),started=useRef(false),submitting=useRef(false),latestTranscript=useRef('');
 const supported=typeof window!=='undefined'&&('webkitSpeechRecognition'in window||'SpeechRecognition'in window);
 useEffect(()=>{setTurns(history||[])},[history]);

 const speakAndListen=()=>{
  if(started.current)return;
  started.current=true;
  setStatus('starting');
  latestTranscript.current='';
  setTranscript('');
  window.speechSynthesis?.cancel();
  
  const u=new SpeechSynthesisUtterance(question);
  const voices=window.speechSynthesis?.getVoices()||[];
  let best=voices.find(v=>v.lang.startsWith('en')&&(v.name.includes('Google')||v.name.includes('Premium')||v.name.includes('Natural')));
  if(!best)best=voices.find(v=>v.lang.startsWith('en-IN')||v.lang.startsWith('en-GB')||v.lang.startsWith('en-US'));
  if(best)u.voice=best;
  u.rate=1;u.pitch=1;
  u.onend=()=>beginRecognition();
  window.speechSynthesis?.speak(u);
 };

 const beginRecognition=()=>{
  if(!supported){setStatus('unsupported');return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const r=new SR();
  r.lang='en-IN';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
  r.onstart=()=>{setStatus('listening');setPermission(true)};
  r.onresult=e=>{
   let text='';
   for(let i=0;i<e.results.length;i++){text+=e.results[i][0].transcript+' '}
   latestTranscript.current=text.trim();
   setTranscript(text.trim());
  };
  r.onend=()=>{
   const answer=latestTranscript.current.trim();
   if(answer&&!submitting.current){
    setStatus('thinking');
    submitting.current=true;
    submit(answer).finally(()=>{submitting.current=false});
   }else if(!answer&&!submitting.current){
    setStatus('idle');
   }
  };
  r.onerror=e=>{
   if(e.error==='not-allowed'||e.error==='service-not-allowed')setStatus('permission');
   else if(e.error!=='aborted')setStatus('error');
  };
  rec.current=r;
  try{r.start()}catch{setStatus('error')}
 };

 const startJourney=()=>{started.current=false;speakAndListen()};

 const submit=async(answer)=>{
  try{
   let data;
   const allQuestions=generateTailoredCVQuestions(cv,jd,roleName||'');
   const localEval=evaluateInterviewTurnLocal(question,answer,turns);
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
   setTurns(x=>[...x,{question,answer,evaluation:finalEval}]);
   setTranscript('');
   latestTranscript.current='';
   setStatus('starting');
   onTurn({...data, evaluation:finalEval, finalFeedback, done:(data&&data.done)||localEval.done}, answer);
   started.current=false;
  }catch(e){
   setStatus('error');
   alert(e.message||'We could not submit this answer. Please try again.');
  }
 };

 useEffect(()=>{
  setStatus('starting');
  started.current=false;
  setTranscript('');
  latestTranscript.current='';
  window.speechSynthesis?.cancel();
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  const t=setTimeout(()=>{if(!started.current)startJourney()},600);
  return()=>{clearTimeout(t);rec.current?.abort();window.speechSynthesis?.cancel()}
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
   <div className="transcript-head"><div className="label"><Headphones size={17}/> Live transcript</div><span>{transcript?'Capturing':'Waiting for your answer'}</span></div>
   <p className={transcript?'live':''}>{transcript||'Your spoken answer will appear here in real time.'}</p>
  </div>
  {permission&&<div className="interview-hint"><Volume2 size={15}/> Question audio · automatic answer capture · 100% hands-free</div>}
 </div>
}

function Feedback({data,answers,onSyncSpokenWins,onHome,onPractiseAgain}){
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[]);
 const d=data||{score:10,strengths:['You completed all questions'],improvements:['Use the STAR method for every answer','Give at least 30-60 seconds per answer','Quantify every result with a number'],nextAction:'Review the model answers below and practise again with real STAR answers from your CV.'};
 const[copied,setCopied]=useState(false);const[synced,setSynced]=useState(false);
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
 const goodAnswers=(answers||[]).filter(a=>a.answer&&a.answer.split(/\s+/).filter(Boolean).length>20);
 const handleSync=()=>{
  if(!goodAnswers.length){alert('Your answers were too brief to sync. Practise again with full STAR answers first.');return;}
  const spokenBullets=goodAnswers.map((a,i)=>{
   const clean=a.answer.replace(/[\r\n]+/g,' ').trim();
   return `• [Interview STAR ${i+1}] ${clean.charAt(0).toUpperCase()+clean.slice(1)}${clean.endsWith('.')?'':'.'}`;
  });
  if(onSyncSpokenWins){onSyncSpokenWins(spokenBullets.join('\n'));setSynced(true);}
 };
 const sc=d.score||10;
 const scoreColor=sc>=75?'#22c55e':sc>=50?'#f59e0b':'#ef4444';
 const scoreLabel=sc>=75?'Interview-ready 🚀':sc>=50?'Keep improving 💪':'Needs more practice 🔥';
 return <div className="feedback"><div className="score-card"><div><span className="eyebrow" style={{color:'#c4b5fd'}}>CAMPUS PLACEMENT SCORECARD</span><h2>{scoreLabel}</h2><p style={{color:'#cbd5e1'}}>Overall Score: <strong>{sc}/100</strong> · Full interview transcript, coaching, and model STAR answers below.</p></div><div className="score-ring"><strong>{sc}</strong><small>/100</small></div></div>
 <div className="insights"><div><h3>Strengths</h3>{(d.strengths||[]).map(x=><p key={x} style={{color:x.startsWith('None')?'#ef4444':'#16a34a',fontWeight:x.startsWith('None')?700:500}}>{x.startsWith('None')?'✕ ':'✓ '}{x}</p>)}</div><div><h3>What to improve</h3>{(d.improvements||[]).map(x=><p key={x}>• {x}</p>)}</div></div>

 <div className="transcript-review"><div className="label-bar"><div className="label"><MessageSquareText size={17}/> Interview transcript &amp; model answers</div><div className="report-actions"><button className="ghost-sm" type="button" onClick={copyReport}>{copied?<><Check size={14}/> Copied!</>:<><FileText size={14}/> Copy report</>}</button><button className="ghost-sm" type="button" onClick={downloadReport}><Upload size={14} style={{transform:'rotate(180deg)'}}/> Download TXT</button></div></div>
  {(answers||[]).map((x,i)=><div className="turn-review" key={i}>
   <div className="turn-review-header"><b>Q{i+1}. {x.question}</b>{x.evaluation?.score!==undefined&&<span className="turn-score" style={{color:x.evaluation.score>=70?'#22c55e':x.evaluation.score>=45?'#f59e0b':'#ef4444'}}>{x.evaluation.score}/100</span>}</div>
   
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
   <button className="secondary" onClick={()=>{if(onHome)onHome();}}><RefreshCw size={16}/> Back to Dashboard</button>
   <button className="primary" onClick={()=>{if(onPractiseAgain)onPractiseAgain();else if(onHome)onHome();}}><Mic size={16}/> Practise Again</button>
  </div>
 </div>
</div>
}

function Module({id,career}){
const[loading,setLoading]=useState(false),[data,setData]=useState(null),[error,setError]=useState('');const[company,setCompany]=useState(''),[problem,setProblem]=useState(''),[idea,setIdea]=useState('');const cv=readSession('gjr_cv_text','');const runCoach=async()=>{setLoading(true);setError('');try{let d;try{d=await post('/api/coach',{module:id==='ai'?'ai':'corporate',context:cv,career})}catch(e){d={diagnosis:'Start with one practical habit this week.',score:70,weeklyHabit:'Write one concise outcome-led update every day.',sevenDayPlan:['Audit one communication habit','Practise a concise update','Ask for one feedback point','Rewrite one weak CV bullet with evidence','Use AI to structure one task','Reflect on what improved','Repeat the strongest habit']}}setData(d)}finally{setLoading(false)}};const runDemo=async()=>{if(!problem.trim()){setError('Describe the company problem first.');return}setLoading(true);setError('');try{setData(await post('/api/demo',{company,problem,idea}))}catch(e){setData({title:'Focused solution concept',tagline:'A simple workflow that reduces friction and creates measurable value.',impact:'Explain the user, problem, workflow and one measurable outcome in your interview.'})}finally{setLoading(false)}};if(id==='readiness'||id==='ai')return <div className="module-panel"><span className="eyebrow">{career==='internship'?'INTERNSHIP':'FULL-TIME'} TRACK</span><h2>{id==='readiness'?'Corporate Ready':'AI at Work'}</h2><p>{id==='readiness'?'Build practical habits for communication, feedback, priorities and resilience.':'Learn practical AI workflows for research, writing, analysis, meetings and responsible automation.'}</p><button className="primary"disabled={loading}onClick={runCoach}>{loading?'Building your plan…':<>Build my 7-day plan <ArrowRight size={18}/></>}</button>{error&&<p role="alert">{error}</p>}{data&&<div className="module-result"><h3>{data.diagnosis||'Your personalised plan'}</h3>{data.score&&<p><b>Readiness score:</b> {data.score}/100</p>}{data.weeklyHabit&&<p><b>Weekly habit:</b> {data.weeklyHabit}</p>}{data.sevenDayPlan&&<><h4>7-day plan</h4>{data.sevenDayPlan.map((x,i)=><p key={i}><b>Day {i+1}:</b> {x}</p>)}</>}</div>}</div>;
 return <div className="module-panel"><span className="eyebrow">STAND OUT IN THE INTERVIEW</span><h2>Build a credible product concept</h2><p>Turn a real company problem into a focused solution you can explain to an interviewer.</p><div className="input-card"><div className="label"><BriefcaseBusiness size={17}/> Company</div><input value={company}onChange={e=>setCompany(e.target.value)}placeholder="e.g. a target employer"/><div className="label"><Target size={17}/> Business problem</div><textarea value={problem}onChange={e=>setProblem(e.target.value)}placeholder="What problem should the company solve?"/><div className="label"><Sparkles size={17}/> Your idea <span>(optional)</span></div><textarea value={idea}onChange={e=>setIdea(e.target.value)}placeholder="Your initial solution idea…"/><button className="primary"disabled={loading||!problem.trim()}onClick={runDemo}>{loading?'Building concept…':<>Build my interview demo <ArrowRight size={18}/></>}</button></div>{error&&<p role="alert">{error}</p>}{data&&<div className="module-result"><span className="eyebrow">PROTOTYPE CONCEPT</span><h3>{data.title}</h3><p><b>{data.tagline}</b></p><p>{data.impact}</p></div>}</div>}

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

