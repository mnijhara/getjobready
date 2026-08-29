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
 const lib=await import('pdfjs-dist');
 const pdfjs=lib.default&&lib.default.getDocument?lib.default:lib;
 pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),disableWorker:true}).promise;
 let out='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const t=await p.getTextContent();out+=t.items.map(x=>x.str).join(' ')+'\n'}return out.trim();
}
async function docxText(file){const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return String(result.value||'').trim()}
async function readFile(file){if(file.type==='text/plain')return file.text();if(/\.pdf$/i.test(file.name))return pdfText(file);if(/\.docx$/i.test(file.name))return docxText(file);throw new Error('Unsupported file type')}

function localReview(cv,jd,mode){const base=fallback(mode);const words=cv.trim().split(/\s+/).filter(Boolean).length;return {...base,score:Math.max(62,Math.min(88,base.score+(words>450?7:words>220?3:0))),summary:mode==='specific'?`Local CV review is ready. Add evidence that directly connects your experience to this job description (${Math.min(3,Math.max(1,Math.round(jd.length/1200)))} priority areas identified).`:`Local CV review is ready. Your draft is editable below and can be improved before the interview.`}}
function localImprove(cv){
 const lines=cv.split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!lines.length)return cv;
 return lines.map((line,i)=>{if(i<3)return line;const clean=line.replace(/^[•●▪-]\s*/,'');if(clean.length<45||/[.!?]$/.test(clean))return line;return `• ${clean.replace(/^I\s+/i,'').replace(/\s+/g,' ')}.`}).join('\n');
}

function Dashboard({profile,onLogout,onNewApp,onOpen,onMasterCV}){
 const[apps,setApps]=useState([]);const[interviews,setInterviews]=useState([]);const[tab,setTab]=useState('apps');
 useEffect(()=>{setApps(db.getApplications());setInterviews(db.getInterviews())},[]);
 const del=id=>{if(!confirm('Delete this application?'))return;db.deleteApplication(id);setApps(db.getApplications())};
 const masterCV=localStorage.getItem('gjr_master_cv')||'';
 return <div className="dashboard">
  <div className="dash-head">
   <div><span className="eyebrow">YOUR WORKSPACE</span><h2>Welcome back, <em>{profile.email.split('@')[0]}</em> 👋</h2><p className="sub">Your preparation hub — CVs, interviews, feedback all in one place.</p></div>
   <button className="ghost-sm" onClick={onLogout}>Sign out</button>
  </div>
  <div className="dash-tabs">
   <button className={tab==='apps'?'selected':''} onClick={()=>setTab('apps')}>📁 My Applications <span className="tab-count">{apps.length}</span></button>
   <button className={tab==='interviews'?'selected':''} onClick={()=>setTab('interviews')}>🎙️ Interview History <span className="tab-count">{interviews.length}</span></button>
  </div>
  {tab==='apps'&&<div className="dash-grid">
   <div className="input-card dash-card master-cv-card" role="button" onClick={onMasterCV}>
    <div className="card-center"><FileText size={28}/><b>Master CV</b><span>{masterCV?'Edit your base CV':'Upload your base CV'}</span>{masterCV&&<span className="cv-preview">{masterCV.slice(0,80)}…</span>}</div>
   </div>
   <div className="input-card dash-card new-card" role="button" onClick={onNewApp}>
    <div className="card-center"><Plus size={28}/><b>New Application</b><span>Tailor your CV to a specific JD and practise</span></div>
   </div>
   {apps.map(a=><div key={a.id} className="input-card dash-card">
    <div className="label"><BriefcaseBusiness size={17}/> {a.role||'General Role'}</div>
    <p><strong>CV Score:</strong> <span style={{color:a.score>=80?'#22c55e':a.score>=65?'#f59e0b':'#ef4444'}}>{a.score||'—'}/100</span></p>
    {a.interviewScore&&<p><strong>Interview Score:</strong> <span style={{color:a.interviewScore>=70?'#22c55e':'#f59e0b'}}>{a.interviewScore}/100</span></p>}
    <p className="sub">Last updated {new Date(a.updated).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
    <div className="card-actions"><button className="secondary" onClick={()=>onOpen(a)}>Open Workspace</button><button className="ghost-sm danger" onClick={()=>del(a.id)}>Delete</button></div>
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
 const questions=useMemo(()=>result?.interviewQuestions?.length?result.interviewQuestions:fallback(prep).interviewQuestions,[result,prep]);
 const handleLogin=email=>{db.saveProfile(email);setProfile({email});setScreen('home')};
 const handleLogout=()=>{db.logout();setProfile(null);setScreen('home')};
 const promptNewApp=()=>{setRoleName('');setShowRoleModal(true)};
 const confirmNewApp=name=>{const id=Date.now().toString();setAppId(id);setRoleName(name||'General');const masterCV=localStorage.getItem('gjr_master_cv')||'';setCv(masterCV);setJd('');setCvFile(null);setJdFile(null);setPrep(masterCV?'general':'specific');saveSession('gjr_cv_mode',masterCV?'general':'specific');setShowRoleModal(false);setScreen('resume')};
 const openApp=a=>{setAppId(a.id);setRoleName(a.role||'');setCv(a.cv||'');setJd(a.jd||'');setPrep(a.jd?'specific':'general');setResult(a.result||null);setScreen('cvstudio')};
 const openMasterCV=()=>{const masterCV=localStorage.getItem('gjr_master_cv')||'';setAppId('master');setCv(masterCV);setJd('');setPrep('general');setResult(null);setScreen('resume')};
 const choosePrep=m=>{setPrep(m);saveSession('gjr_cv_mode',m);setScreen('resume')};
 const changeCareer=v=>{setCareer(v);saveSession('gjr_career',v)};
 const parseFile=async(kind,file)=>{if(!file)return;const ok=kind==='cv'?/\.(pdf|txt|docx)$/i.test(file.name):/\.(pdf|txt)$/i.test(file.name);if(!ok){alert(kind==='cv'?'Please upload a PDF, DOCX or TXT CV.':'Please upload a PDF or TXT job description.');return}try{const text=await readFile(file);if(!text.trim())throw new Error('The file contains no readable text. Please paste the text instead.');if(kind==='cv'){setCvFile(file);setCv(text);saveSession('gjr_cv_text',text)}else{setJdFile(file);setJd(text);saveSession('gjr_jd_text',text)}}catch(e){console.error(e);alert(`We could not read that file. ${e.message||'Please paste the text instead.'}`)}};
 const clearFile=kind=>{if(kind==='cv'){setCvFile(null);setCv('');try{sessionStorage.removeItem('gjr_cv_text')}catch{}}else{setJdFile(null);setJd('');try{sessionStorage.removeItem('gjr_jd_text')}catch{}}};
 const analyze=async()=>{if(!cv.trim())return alert('Upload your CV or paste your CV text.');if(prep==='specific'&&!jd.trim())return alert('Upload or paste the job description for a role-specific preparation.');setLoading(true);try{let data;try{data=await post('/api/analyze',{cv,jd:prep==='general'?'':jd,career,mode:prep})}catch(e){console.warn('AI review unavailable; using local review',e);data=localReview(cv,jd,prep)}setResult(data);saveSession('gjr_cv_mode',prep);saveSession('gjr_cv_text',cv);saveSession('gjr_jd_text',prep==='general'?'':jd);setScreen('cvstudio')}finally{setLoading(false)}};
 const saveFinal=text=>{setCv(text);saveSession('gjr_cv_ready','1');saveSession('gjr_cv_improved',text);saveSession('gjr_cv_text',text);if(appId==='master'){localStorage.setItem('gjr_master_cv',text)}else if(profile){db.saveApplication({id:appId,role:roleName||'General CV',cv:text,score:result?.score,jd,result})}};
 const startInterview=text=>{if(text)setCv(text);setQIndex(0);setAnswers([]);setScreen('interview')};
 const saveInterviewResult=d=>{if(profile){db.saveInterview({role:roleName||'General Interview',score:d.score,strengths:d.strengths,nextAction:d.nextAction,appId});db.saveApplication({id:appId,role:roleName||'General CV',cv,score:result?.score,jd,result,interviewScore:d.score})}; setResult(r=>({...r,feedback:d}));setScreen('feedback')};
 const goHome=()=>setScreen('home');
 if(screen==='home'){if(profile)return <Workspace title="My Workspace" subtitle="Your preparation hub." icon={<Folder/>} onHome={goHome}><Dashboard profile={profile} onLogout={handleLogout} onNewApp={promptNewApp} onOpen={openApp} onMasterCV={openMasterCV}/>{showRoleModal&&<div className="modal" onClick={e=>e.target===e.currentTarget&&setShowRoleModal(false)}><div className="modal-card login-card"><span className="eyebrow">NEW APPLICATION</span><h2>What role are you applying for?</h2><p>Name this workspace so you can find it later. Your master CV will be pre-loaded.</p><input type="text" className="login-input" placeholder="e.g. Deloitte – Management Consulting" value={roleName} onChange={e=>setRoleName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmNewApp(roleName)} autoFocus/><div style={{display:'flex',gap:'12px',justifyContent:'center'}}><button className="ghost-sm" onClick={()=>setShowRoleModal(false)}>Cancel</button><button className="primary" onClick={()=>confirmNewApp(roleName)}>Create <ArrowRight size={16}/></button></div></div></div>}</Workspace>;return <Home career={career}setCareer={changeCareer}choosePrep={choosePrep}openModule={setScreen}onLogin={handleLogin}/>}
 if(screen==='resume')return <Workspace title={prep==='general'?'General CV Preparation':'CV + Job Description'} subtitle={prep==='general'?'Review your CV without a target role. Save the final version before interviewing.':'Upload your CV and one specific JD. Improve the CV before you practise the role-specific interview.'} icon={<FileText/>} back={()=>setScreen('home')} onHome={goHome}><Prep prep={prep}setPrep={setPrep}cv={cv}setCv={setCv}jd={jd}setJd={setJd}cvFile={cvFile}jdFile={jdFile}parseFile={parseFile}clearFile={clearFile}analyze={analyze}loading={loading}/></Workspace>;
 if(screen==='cvstudio')return <Workspace title="Improve your CV first" subtitle={prep==='general'?'Review, edit and save your CV. Your interview will use the final version.':'Make your CV stronger for this role before you practise the interview.'} icon={<Sparkles/>} back={()=>setScreen('resume')} onHome={goHome}><CVStudio result={result||fallback(prep)}initial={cv}mode={prep}onSave={saveFinal}onContinue={startInterview}/></Workspace>;
 if(screen==='interview')return <Workspace title="AI Audio Interview" subtitle={prep==='general'?'General interview grounded in your final CV.':'Role-specific interview grounded in your final CV + JD.'} icon={<Mic/>} back={()=>setScreen('cvstudio')} onHome={goHome}><VoiceInterview cv={cv}jd={jd}mode={prep}career={career}question={questions[qIndex]}turn={qIndex+1}maxTurns={7}history={answers}onTurn={(d,a)=>{setAnswers(x=>[...x,{question:questions[qIndex],answer:a,evaluation:d?.evaluation}]);if(!d.done&&d.nextQuestion){setResult(r=>({...r,interviewQuestions:[...(r?.interviewQuestions||questions),d.nextQuestion]}));setQIndex(i=>i+1)}}}onDone={saveInterviewResult}/></Workspace>;
 if(screen==='feedback')return <Workspace title="Interview Feedback" subtitle="Your transcript, strengths and next actions." icon={<MessageSquareText/>} back={()=>setScreen('home')} onHome={goHome}><Feedback data={result?.feedback}answers={answers}onSyncSpokenWins={bullets=>{setCv(prev=>prev+'\n\n'+bullets);saveSession('gjr_cv_text',cv+'\n\n'+bullets);if(profile)db.saveApplication({id:appId,role:roleName||'General CV',cv:cv+'\n\n'+bullets,score:result?.score,jd,result})}}/></Workspace>;
 return <Workspace title={modules.find(x=>x.id===screen)?.title||'GetJobReady'} subtitle={modules.find(x=>x.id===screen)?.text||''} icon={<Sparkles/>} back={()=>setScreen('home')} onHome={goHome}><Module id={screen}career={career}/></Workspace>
}

function Header({onHow,back,onHome}){return <header><div className="header-left">{back&&<button className="back"onClick={back}>← Back</button>}</div><button className="brand"onClick={onHome}style={{background:'none',border:'none',padding:0,cursor:onHome?'pointer':'default'}}><span className="logo">GJ</span><span>GetJobReady<span className="dot">.online</span></span></button>{onHow?<button className="ghost"onClick={onHow}><Sparkles size={15}/> How it works</button>:<div className="header-spacer"/>}</header>}

function Home({career,setCareer,choosePrep,openModule,onLogin}){const[how,setHow]=useState(false),[showLogin,setShowLogin]=useState(false),[email,setEmail]=useState('');return <div className="app"><Header onHow={()=>setHow(true)}/><main className="hero"><div><span className="trust-badge"><Sparkles size={13}/> Trusted by students at IIMs, ISBs &amp; top B-schools</span></div><div className="eyebrow">{career==='internship'?'INTERNSHIP TRACK':'FULL-TIME TRACK'} · AI-POWERED CAREER READINESS</div><h1>Your degree got you here.<br/><em>Let's get you hired.</em></h1><p className="lead">{career==='internship'?'Build a strong campus story, sharpen your CV and practise with a real AI voice interviewer before the big day.':'Improve your CV for the exact role, then practise a hands-free AI interview that adapts to your answers.'}</p><div className="career-toggle"><button className={career==='internship'?'active':''}onClick={()=>setCareer('internship')}>☀️ Internship</button><button className={career==='job'?'active':''}onClick={()=>setCareer('job')}>💼 Full-time</button></div><button className="primary hero-btn"onClick={()=>setShowLogin(true)}>Enter Workspace <ArrowRight size={18}/></button><div className="hero-stats"><div className="stat"><span className="stat-num">4</span><span className="stat-label">Prep Steps</span></div><div className="stat"><span className="stat-num">100%</span><span className="stat-label">Voice-powered</span></div><div className="stat"><span className="stat-num">Free</span><span className="stat-label">No sign-up</span></div></div><div className="proof"><span><CheckCircle2 size={16}/> CV review before interview</span><span><CheckCircle2 size={16}/> Hands-free voice interview</span><span><CheckCircle2 size={16}/> Instant feedback &amp; transcript</span></div></main><section className="module-grid">{modules.map(m=><button className="module-card"key={m.id}onClick={()=>m.id==='resume'?setShowLogin(true):m.id==='interview'?setShowLogin(true):openModule(m.id)}><div className="module-top"><span className="module-icon"><m.icon size={21}/></span><span className="pill">{m.tag}</span></div><h3>{m.title}</h3><p>{m.text}</p><span className="card-link">{m.id==='interview'?'Start with your CV':'Open'} <ChevronRight size={16}/></span></button>)}</section><section className="roadmap"><div><span className="eyebrow">THE JOURNEY</span><h2>Prepare → practise → improve.</h2></div><div className="steps"><div><b>01</b><span>Prepare</span><small>CV review + editor</small></div><div><b>02</b><span>Practise</span><small>Hands-free voice</small></div><div><b>03</b><span>Improve</span><small>Transcript + feedback</small></div></div></section><footer>Built for students entering their first internship or corporate role.</footer>{how&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setHow(false)}><div className="modal-card"><button className="modal-x"onClick={()=>setHow(false)}><X size={18}/></button><span className="eyebrow">HOW GETJOBREADY WORKS</span><h2>Prepare → practise → improve.</h2><div className="how-steps"><div><b>01</b><strong>Upload your CV</strong><span>Use General CV mode or add one specific JD.</span></div><div><b>02</b><strong>Improve before interviewing</strong><span>AI reviews your CV and gives you an editable version. If AI is temporarily unavailable, the CV studio still opens with a useful local review.</span></div><div><b>03</b><strong>Have a real voice interview</strong><span>AI asks the question aloud, then your answer is captured into the live transcript automatically.</span></div><div><b>04</b><strong>Get adaptive feedback</strong><span>Review your transcript, strengths and next actions.</span></div></div><button className="primary wide"onClick={()=>{setHow(false);setShowLogin(true)}}>Enter Workspace <ArrowRight size={18}/></button></div></div>}{showLogin&&<div className="modal"onClick={e=>e.target===e.currentTarget&&setShowLogin(false)}><div className="modal-card login-card"><button className="modal-x"onClick={()=>setShowLogin(false)}><X size={18}/></button><span className="eyebrow">ACCESS WORKSPACE</span><h2>Enter your email</h2><p>We'll save your CVs and interview history securely on your device.</p><input type="email"className="login-input"placeholder="student@university.edu"value={email}onChange={e=>setEmail(e.target.value)}onKeyDown={e=>e.key==='Enter'&&email.includes('@')&&onLogin(email)}/><button className="primary wide"onClick={()=>{if(email.includes('@'))onLogin(email);else alert('Please enter a valid email.')}}>Continue <ArrowRight size={18}/></button></div></div>}</div>}

function Workspace({title,subtitle,icon,back,onHome,children}){return <div className="app"><Header back={back} onHome={onHome}/><main className="workspace"><div className="workspace-head"><span className="big-icon">{icon}</span><div><div className="eyebrow">YOUR PREPARATION</div><h1>{title}</h1><p>{subtitle}</p></div></div>{children}</main></div>}

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

function CVStudio({result,initial,mode,onSave,onContinue}){
 const[draft,setDraft]=useState(()=>String(initial||''));
 const[improving,setImproving]=useState(false),[improved,setImproved]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const[theme,setTheme]=useState('executive');
 const[showWinsModal,setShowWinsModal]=useState(false);
 const[winQ1,setWinQ1]=useState(''),[winQ2,setWinQ2]=useState(''),[winQ3,setWinQ3]=useState('');
 
 const run=async()=>{if(!draft.trim())return;setImproving(true);setError('');try{const r=await post('/api/improve-cv',{cv:draft,review:result,mode});if(r.cv){setDraft(r.cv);setImproved(true)}else throw new Error('No improved draft returned')}catch(e){console.warn(e);setDraft(localImprove(draft));setImproved(true);setError('AI improvement is temporarily unavailable, so a local editing pass was applied. You can keep editing it.')}finally{setImproving(false)}};
 const copyDraft=()=>{navigator.clipboard?.writeText(draft);setCopied(true);setTimeout(()=>setCopied(false),2000)};
 
 const hasAI=/ai|chatgpt|claude|llm|copilot|prompt|python|analytics|sql/i.test(draft);

 const addAIBullet=(bulletText)=>{
  setDraft(prev=>prev+'\n• '+bulletText);
  setImproved(true);
 };

 const addUncoveredWin=()=>{
  if(!winQ1.trim())return alert('Please enter your internship or project achievement.');
  const bullet=`• ${winQ1.trim()}${winQ2.trim() ? ` using ${winQ2.trim()}` : ''}${winQ3.trim() ? `, resulting in ${winQ3.trim()}` : ''}.`;
  setDraft(prev=>prev+'\n'+bullet);
  setWinQ1('');setWinQ2('');setWinQ3('');
  setShowWinsModal(false);
  setImproved(true);
 };

 const getFormattedHTML=()=>{
  let text=draft
   .replace(/(E\s*X\s*E\s*C\s*U\s*T\s*I\s*V\s*E\s*S\s*U\s*M\s*M\s*A\s*R\s*Y|EXECUTIVE SUMMARY)/gi,'\nEXECUTIVE SUMMARY\n')
   .replace(/(C\s*O\s*R\s*E\s*C\s*O\s*M\s*P\s*E\s*T\s*E\s*N\s*C\s*I\s*E\s*S|CORE COMPETENCIES)/gi,'\nCORE COMPETENCIES\n')
   .replace(/(P\s*R\s*O\s*F\s*E\s*S\s*S\s*I\s*O\s*N\s*A\s*L\s*E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE)/gi,'\nPROFESSIONAL EXPERIENCE\n')
   .replace(/(E\s*D\s*U\s*C\s*A\s*T\s*I\s*O\s*N\s*&\s*L\s*A\s*N\s*G\s*U\s*A\s*G\s*E\s*S|EDUCATION & LANGUAGES|EDUCATION)/gi,'\nEDUCATION & LANGUAGES\n')
   .replace(/(▪|•|◆)/g,'\n$1 ');

  const rawLines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  let html='<div class="cv-container">';let inList=false;let hasHeader=false;

  rawLines.forEach((trimmed)=>{
   const hasLetters=/[a-zA-Z]/.test(trimmed);
   const isAllUpper=hasLetters&&trimmed.toUpperCase()===trimmed;
   const isHeading=isAllUpper&&trimmed.length>2&&trimmed.length<50&&!/^[•\-▪*◆]/.test(trimmed);
   const isBullet=/^[•\-▪*◆]/.test(trimmed);

   if(isBullet&&!inList){html+='<ul>';inList=true}
   else if(!isBullet&&inList){html+='</ul>';inList=false}

   if(!hasHeader&&trimmed.length<120&&!isBullet&&!isHeading){
    html+=`<div class="cv-header"><h1>${trimmed}</h1></div>`;hasHeader=true;
   }else if(isHeading){
    const cleanHeading=trimmed.replace(/\s+/g,' ');
    html+=`<h2>${cleanHeading}</h2>`;
   }else if(isBullet){
    html+=`<li>${trimmed.replace(/^[•\-▪*◆]\s*/,'')}</li>`;
   }else if(trimmed.includes(' · ')||(trimmed.includes(' - ')&&trimmed.length<120)){
    html+=`<p class="job-title"><strong>${trimmed}</strong></p>`;
   }else{
    html+=`<p>${trimmed}</p>`;
   }
  });
  if(inList)html+='</ul>';html+='</div>';

  let css='';
  if(theme==='consulting'){
   css=`@media print{@page{margin:12mm}}body{font-family:'Georgia','Times New Roman',serif;color:#0f172a;line-height:1.4;margin:0;padding:0;background:#fff}.cv-container{max-width:750px;margin:0 auto;padding:25px 30px}.cv-header{text-align:center;border-bottom:1.5px solid #0f172a;padding-bottom:8px;margin-bottom:14px}.cv-header h1{font-size:19px;color:#0f172a;margin:0;font-weight:700;letter-spacing:0.5px}h2{font-size:11.5px;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin-top:14px;margin-bottom:6px;font-weight:700}p{font-size:10px;margin:3px 0;color:#334155}p.job-title{font-size:10.5px;color:#0f172a;margin-top:6px;margin-bottom:2px;font-weight:700}ul{margin:2px 0 6px 0;padding-left:16px}li{font-size:10px;margin-bottom:2px;color:#334155}strong{font-weight:700}`;
  }else if(theme==='modern'){
   css=`@media print{@page{margin:12mm}}body{font-family:'Inter','Segoe UI',sans-serif;color:#1e293b;line-height:1.45;margin:0;padding:0;background:#fff}.cv-container{max-width:750px;margin:0 auto;padding:25px 30px}.cv-header{text-align:left;border-left:4px solid #2563eb;padding-left:14px;margin-bottom:18px}.cv-header h1{font-size:20px;color:#1e293b;margin:0;font-weight:800}h2{font-size:12px;color:#2563eb;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #eff6ff;padding-bottom:3px;margin-top:16px;margin-bottom:6px;font-weight:700}p{font-size:10.5px;margin:3px 0;color:#475569}p.job-title{font-size:11px;color:#0f172a;margin-top:7px;margin-bottom:2px;font-weight:700}ul{margin:3px 0 8px 0;padding-left:16px}li{font-size:10.5px;margin-bottom:2.5px;color:#475569}strong{font-weight:700;color:#0f172a}`;
  }else{
   // Executive (IIM / Wharton Style)
   css=`@media print{@page{margin:12mm}}body{font-family:'Garamond','Georgia',serif;color:#111827;line-height:1.45;margin:0;padding:0;background:#fff}.cv-container{max-width:750px;margin:0 auto;padding:25px 30px}.cv-header{text-align:center;border-bottom:2.5px double #1e3a8a;padding-bottom:10px;margin-bottom:16px}.cv-header h1{font-size:21px;color:#1e3a8a;margin:0;font-weight:700;letter-spacing:0.8px}h2{font-size:12px;color:#1e3a8a;text-transform:uppercase;letter-spacing:1.3px;border-bottom:1px solid #bfdbfe;padding-bottom:3px;margin-top:16px;margin-bottom:6px;font-weight:700}p{font-size:10.5px;margin:3px 0;color:#374151}p.job-title{font-size:11px;color:#111827;margin-top:7px;margin-bottom:2px;font-style:italic}ul{margin:3px 0 8px 0;padding-left:16px}li{font-size:10.5px;margin-bottom:2.5px;color:#374151}strong{font-weight:700}`;
  }
  return `<html><head><meta charset="utf-8"><title>CV</title><style>${css}</style></head><body>${html}</body></html>`;
 };

 const downloadPDF=()=>{const w=window.open('','_blank');w.document.write(getFormattedHTML());w.document.close();w.focus();setTimeout(()=>{w.print();w.close()},500)};
 const downloadWord=()=>{
  const html=getFormattedHTML().replace('<html>',`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`);
  const blob=new Blob(['\ufeff',html],{type:'application/msword'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='CV_GetJobReady.doc';a.click();URL.revokeObjectURL(url);
 };
 const scoreColor=result.score>=80?'#22c55e':result.score>=65?'#f59e0b':'#ef4444';
 return <div className="studio"><div className="score-card"><div><span className="eyebrow">AI CV REVIEW · PLACEMENT READINESS</span><h2>{result.headline}</h2><p>{result.summary}</p></div><div className="score-ring" style={{'--score-color':scoreColor}}><strong style={{color:scoreColor}}>{result.score}</strong><small>/100</small></div></div><div className="insights"><div><h3>What to improve</h3>{result.gaps?.map(x=><p key={x}>• {x}</p>)}</div><div><h3>Keep these strengths</h3>{result.highlights?.map(x=><p key={x}>✓ {x}</p>)}</div></div>

 {/* AI & Skills Booster Section */}
 <div className="input-card ai-booster-card">
  <div className="label"><Sparkles size={17}/> AI & Technology Skills Booster</div>
  {!hasAI?<div className="booster-alert"><p>💡 <b>Recruiters expect AI fluency in 2026.</b> Your CV doesn't mention how you use AI or modern data tools. Click below to add pre-formatted STAR impact bullets:</p>
   <div className="bullet-chips">
    <button type="button" className="preset-pill" onClick={()=>addAIBullet('Leveraged AI research assistants (ChatGPT & Claude) to synthesize 40+ competitor reports, accelerating market mapping turnaround by 35%.')}>+ Add LLM / ChatGPT Research Bullet</button>
    <button type="button" className="preset-pill" onClick={()=>addAIBullet('Utilised GitHub Copilot & Python automation scripts to audit and clean 5,000+ data records with 99.4% precision.')}>+ Add AI Automation & Python Bullet</button>
    <button type="button" className="preset-pill" onClick={()=>addAIBullet('Implemented AI prompt engineering workflows to streamline team documentation and customer query responses.')}>+ Add Prompt Engineering Bullet</button>
   </div>
  </div>:<div className="booster-alert success"><p>✓ Great! Your CV highlights modern AI or analytical tools.</p></div>}
  <div className="free-courses">
   <span className="preset-title">🎓 Recommended Free AI Certifications to Boost Your CV:</span>
   <div className="course-links">
    <a href="https://www.coursera.org/learn/google-ai-essentials" target="_blank" rel="noreferrer" className="course-chip">Google AI Essentials (Free) ↗</a>
    <a href="https://www.deeplearning.ai/courses/ai-for-everyone/" target="_blank" rel="noreferrer" className="course-chip">DeepLearning.AI – AI for Everyone ↗</a>
    <a href="https://online.wharton.upenn.edu/ai-for-business-specialization/" target="_blank" rel="noreferrer" className="course-chip">Wharton AI for Business ↗</a>
   </div>
  </div>
 </div>

 {/* Uncover Hidden Achievements CTA */}
 <div className="input-card wins-trigger-card">
  <div><b>🔍 Did you forget to include key achievements?</b><span>Students frequently leave out real wins from summer internships or college projects. Answer 3 quick prompts to extract them.</span></div>
  <button type="button" className="secondary" onClick={()=>setShowWinsModal(true)}><Sparkles size={16}/> Extract Hidden Achievements</button>
 </div>

 <div className="editor-card"><div className="editor-head"><div className="label"><FileText size={17}/> Your editable CV (STAR Framework Ready)</div>
 <div className="theme-picker">
  <span>Template:</span>
  <button className={theme==='executive'?'active':''} onClick={()=>setTheme('executive')}>🏛️ Executive</button>
  <button className={theme==='consulting'?'active':''} onClick={()=>setTheme('consulting')}>💼 Consulting</button>
  <button className={theme==='modern'?'active':''} onClick={()=>setTheme('modern')}>⚡ Tech</button>
 </div>
 <div className="editor-controls"><span>Autosaved</span><button className="ghost-sm"type="button"onClick={copyDraft}>{copied?<><Check size={14}/> Copied!</>:<><FileText size={14}/> Copy CV</>}</button><button className="ghost-sm"type="button"onClick={downloadPDF}>Download PDF</button><button className="ghost-sm"type="button"onClick={downloadWord}>Download Word</button></div></div><textarea value={draft}onChange={e=>{setDraft(e.target.value);setImproved(false);saveSession('gjr_cv_text',e.target.value)}}placeholder="Your CV text will appear here. Edit anything you want before your interview."/><div className="editor-actions"><button className="secondary"onClick={run}disabled={improving||!draft.trim()}>{improving?'Improving…':<>✨ Format & improve with AI</>}</button>{improved&&<span className="saved-note"><CheckCircle2 size={15}/> Improved draft ready</span>}</div>{error&&<p className="inline-note">{error}</p>}</div><div className="continue-card"><div><b>Next: live interview</b><span>Save your final CV first. The interviewer will use exactly this version.</span></div><button className="primary"disabled={!draft.trim()}onClick={()=>{onSave(draft);onContinue(draft)}}>Save & continue to live interview <ArrowRight size={18}/></button></div>

 {showWinsModal&&<div className="modal" onClick={e=>e.target===e.currentTarget&&setShowWinsModal(false)}>
  <div className="modal-card wins-modal">
   <button className="modal-x" onClick={()=>setShowWinsModal(false)}><X size={18}/></button>
   <span className="eyebrow">UNCOVER HIDDEN ACHIEVEMENTS</span>
   <h2>What did you accomplish in your internship or project?</h2>
   <p>Fill in what you actually did — AI will format it into a high-impact STAR bullet for your CV.</p>
   <div className="wins-form">
    <label>1. What was your main task or project responsibility?</label>
    <input type="text" className="login-input" placeholder="e.g. Conducted market research for client onboarding" value={winQ1} onChange={e=>setWinQ1(e.target.value)}/>
    <label>2. What tools, AI tech, or methods did you use?</label>
    <input type="text" className="login-input" placeholder="e.g. ChatGPT, Excel pivot tables, SQL, Figma" value={winQ2} onChange={e=>setWinQ2(e.target.value)}/>
    <label>3. What was the outcome or measurable result?</label>
    <input type="text" className="login-input" placeholder="e.g. Reduced turnaround time by 30% / Onboarded 50+ clients" value={winQ3} onChange={e=>setWinQ3(e.target.value)}/>
    <button className="primary wide" type="button" onClick={addUncoveredWin}><Sparkles size={16}/> Format & Insert into My CV</button>
   </div>
  </div>
 </div>}
 </div>
}

 function VoiceInterview({cv,jd,mode,career,question,turn,maxTurns,history,onTurn,onDone}){
 const[status,setStatus]=useState('starting'),[transcript,setTranscript]=useState(''),[turns,setTurns]=useState(history||[]),[permission,setPermission]=useState(false),rec=useRef(null),started=useRef(false),submitting=useRef(false);
 const supported=typeof window!=='undefined'&&('webkitSpeechRecognition'in window||'SpeechRecognition'in window);
 useEffect(()=>{setTurns(history||[])},[history]);
 const speakAndListen=()=>{if(started.current)return;started.current=true;window.speechSynthesis?.cancel();const u=new SpeechSynthesisUtterance(question);const voices=window.speechSynthesis?.getVoices()||[];let best=voices.find(v=>v.lang.startsWith('en')&&(v.name.includes('Google')||v.name.includes('Premium')||v.name.includes('Natural')));if(!best)best=voices.find(v=>v.lang.startsWith('en-IN')||v.lang.startsWith('en-GB')||v.lang.startsWith('en-US'));if(best)u.voice=best;u.rate=1;u.pitch=1;u.onend=()=>beginRecognition();window.speechSynthesis?.speak(u)};
 const beginRecognition=()=>{if(!supported){setStatus('unsupported');return}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const r=new SR();r.lang='en-IN';r.interimResults=true;r.continuous=false;r.maxAlternatives=1;r.onstart=()=>{setStatus('listening');setPermission(true)};r.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript+' ';setTranscript(text.trim())};r.onend=()=>{const answer=transcript.trim();setStatus(answer?'thinking':'idle');if(answer&&!submitting.current){submitting.current=true;submit(answer).finally(()=>{submitting.current=false})}};r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed')setStatus('permission');else if(e.error!=='aborted')setStatus('error')};rec.current=r;try{r.start()}catch{setStatus('error')}};
 const startJourney=()=>{started.current=false;speakAndListen()};
 const submit=async(answer)=>{try{let data;try{data=await post('/api/interview-turn',{cv,jd,mode,career,question,answer,history:turns,turn,maxTurns})}catch(e){console.warn(e);const next=fallback(mode).interviewQuestions[turn]||'Tell me what you would improve in your next answer.';data={done:turn>=maxTurns,nextQuestion:next,evaluation:{score:70,notes:'Clear answer captured. Add a specific example and measurable outcome.'},finalFeedback:{score:70,strengths:['You answered with your own experience'],improvements:['Add a concrete example','Quantify the result'],nextAction:'Repeat the interview with one stronger STAR story.'}}}setTurns(x=>[...x,{question,answer,evaluation:data.evaluation}]);setTranscript('');if(data.done)onDone(data.finalFeedback||data);else{onTurn(data,answer);started.current=false}}catch(e){setStatus('error');alert(e.message||'We could not submit this answer. Please try again.')}};
 useEffect(()=>{setStatus('starting');started.current=false;setTranscript('');window.speechSynthesis?.cancel();const t=setTimeout(()=>{if(!started.current)startJourney()},800);return()=>{clearTimeout(t);rec.current?.abort();window.speechSynthesis?.cancel()}},[question,turn]);
 return <div className="interview"><div className="interview-progress">{Array.from({length:maxTurns}).map((_,i)=><div key={i} className={`dot ${i<turn-1?'done':i===turn-1?'active':''}`}/>)}</div><div className="question-card"aria-live="polite"><span className="eyebrow">QUESTION {turn} OF {maxTurns}</span><h2>{question}</h2><p>{status==='thinking'?'Evaluating your answer…':status==='listening'?'I’m listening. Finish naturally — I’ll capture it automatically.':'The question will be spoken aloud. Tap the mic once to begin; after that the interview runs hands-free.'}</p></div><div className={`voice-card handsfree ${status}`}onClick={status==='idle'||status==='permission'||status==='error'?startJourney:undefined}role="button"tabIndex={0}onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startJourney()}}}><div className={`mic ${status}`}><Mic size={38}/>{status==='listening'&&<i/>}</div><div className="voice-state"><b>{status==='listening'?'Listening…':status==='thinking'?'AI is evaluating…':status==='permission'?'Tap to allow microphone':'Tap mic to begin'}</b><span>{supported?'No submit button. Your answer is captured when you finish speaking.':'Use Chrome on Android or desktop for voice input.'}</span></div></div><div className="transcript-card"><div className="transcript-head"><div className="label"><Headphones size={17}/> Live transcript</div><span>{transcript?'Capturing':'Waiting for your answer'}</span></div><p className={transcript?'live':''}>{transcript||'Your spoken answer will appear here in real time.'}</p></div>{permission&&<div className="interview-hint"><Volume2 size={15}/> Question audio · automatic answer capture · no manual submit</div>}</div>
}

function Feedback({data,answers,onSyncSpokenWins}){
 const d=data||{score:70,strengths:['You completed the interview with genuine experience'],improvements:['Add measurable outcomes and STAR structure'],nextAction:'Repeat the interview with a sharper STAR story.'};
 const[copied,setCopied]=useState(false);const[synced,setSynced]=useState(false);
 const copyReport=()=>{
  const text=`GETJOBREADY INTERVIEW REPORT\nOverall Score: ${d.score||70}/100\nNext Action: ${d.nextAction}\n\nStrengths:\n${(d.strengths||[]).map(s=>'- '+s).join('\n')}\n\nImprovements:\n${(d.improvements||[]).map(i=>'- '+i).join('\n')}\n\nTRANSCRIPT:\n${(answers||[]).map((a,i)=>`Q${i+1}: ${a.question}\nA: ${a.answer}`).join('\n\n')}`;
  navigator.clipboard?.writeText(text);
  setCopied(true);
  setTimeout(()=>setCopied(false),2000);
 };
 const downloadReport=()=>{
  const text=`GETJOBREADY CAMPUS PLACEMENT READINESS REPORT\nScore: ${d.score||70}/100\nNext Action: ${d.nextAction}\n\nStrengths:\n${(d.strengths||[]).map(s=>'- '+s).join('\n')}\n\nImprovements:\n${(d.improvements||[]).map(i=>'- '+i).join('\n')}\n\nTRANSCRIPT:\n${(answers||[]).map((a,i)=>`Q${i+1}: ${a.question}\nA: ${a.answer}`).join('\n\n')}`;
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='GetJobReady_Report.txt';a.click();
  URL.revokeObjectURL(url);
 };
 const handleSync=()=>{
  if(!answers?.length)return;
  const spokenBullets=answers.filter(a=>a.answer&&a.answer.length>15).map(a=>`• [Interview Insight] ${a.answer}`);
  if(spokenBullets.length>0&&onSyncSpokenWins){
   onSyncSpokenWins(spokenBullets.join('\n'));
   setSynced(true);
  }
 };
 const sc=d.score||70;const scoreColor=sc>=80?'#22c55e':sc>=65?'#f59e0b':'#ef4444';const scoreLabel=sc>=80?'Interview-ready 🚀':sc>=65?'On track — keep going 💪':'Keep practising — you got this 🔥';
 return <div className="feedback"><div className="score-card"><div><span className="eyebrow">CAMPUS PLACEMENT SCORECARD</span><h2>{scoreLabel}</h2><p>Your full interview transcript and personalised feedback are below.</p></div><div className="score-ring" style={{'--score-color':scoreColor}}><strong style={{color:scoreColor}}>{sc}</strong><small>/100</small></div></div><div className="insights"><div><h3>Strengths</h3>{d.strengths?.map(x=><p key={x}>✓ {x}</p>)}</div><div><h3>Next improvements</h3>{d.improvements?.map(x=><p key={x}>• {x}</p>)}</div></div>
 
 <div className="input-card sync-wins-card">
  <div><b>✨ Sync Spoken Achievements to Your CV</b><span>You spoke great details in your answers that might be missing from your written CV draft. Click below to add your spoken STAR points back to your CV draft!</span></div>
  <button type="button" className="secondary" disabled={synced} onClick={handleSync}>{synced?<><Check size={16}/> Spoken wins added to CV!</>:<>✨ Add Spoken Points to My CV</>}</button>
 </div>

 <div className="transcript-review"><div className="label-bar"><div className="label"><MessageSquareText size={17}/> Interview transcript</div><div className="report-actions"><button className="ghost-sm"type="button"onClick={copyReport}>{copied?<><Check size={14}/> Copied!</>:<><FileText size={14}/> Copy report</>}</button><button className="ghost-sm"type="button"onClick={downloadReport}><Upload size={14}style={{transform:'rotate(180deg)'}}/> Download TXT</button></div></div>{(answers||[]).map((x,i)=><div className="turn-review"key={i}><b>Q{i+1}. {x.question}</b><p>{x.answer}</p></div>)}</div><div className="continue-card"><div><b>Next action</b><span>{d.nextAction}</span></div><button className="primary"onClick={()=>location.reload()}><RefreshCw size={17}/> Practise again</button></div></div>
}

function Module({id,career}){const[loading,setLoading]=useState(false),[data,setData]=useState(null),[error,setError]=useState('');const[company,setCompany]=useState(''),[problem,setProblem]=useState(''),[idea,setIdea]=useState('');const cv=readSession('gjr_cv_text','');const runCoach=async()=>{setLoading(true);setError('');try{let d;try{d=await post('/api/coach',{module:id==='ai'?'ai':'corporate',context:cv,career})}catch(e){d={diagnosis:'Start with one practical habit this week.',score:70,weeklyHabit:'Write one concise outcome-led update every day.',sevenDayPlan:['Audit one communication habit','Practise a concise update','Ask for one feedback point','Rewrite one weak CV bullet with evidence','Use AI to structure one task','Reflect on what improved','Repeat the strongest habit']}}setData(d)}finally{setLoading(false)}};const runDemo=async()=>{if(!problem.trim()){setError('Describe the company problem first.');return}setLoading(true);setError('');try{setData(await post('/api/demo',{company,problem,idea}))}catch(e){setData({title:'Focused solution concept',tagline:'A simple workflow that reduces friction and creates measurable value.',impact:'Explain the user, problem, workflow and one measurable outcome in your interview.'})}finally{setLoading(false)}};if(id==='readiness'||id==='ai')return <div className="module-panel"><span className="eyebrow">{career==='internship'?'INTERNSHIP':'FULL-TIME'} TRACK</span><h2>{id==='readiness'?'Corporate Ready':'AI at Work'}</h2><p>{id==='readiness'?'Build practical habits for communication, feedback, priorities and resilience.':'Learn practical AI workflows for research, writing, analysis, meetings and responsible automation.'}</p><button className="primary"disabled={loading}onClick={runCoach}>{loading?'Building your plan…':<>Build my 7-day plan <ArrowRight size={18}/></>}</button>{error&&<p role="alert">{error}</p>}{data&&<div className="module-result"><h3>{data.diagnosis||'Your personalised plan'}</h3>{data.score&&<p><b>Readiness score:</b> {data.score}/100</p>}{data.weeklyHabit&&<p><b>Weekly habit:</b> {data.weeklyHabit}</p>}{data.sevenDayPlan&&<><h4>7-day plan</h4>{data.sevenDayPlan.map((x,i)=><p key={i}><b>Day {i+1}:</b> {x}</p>)}</>}</div>}</div>;
 return <div className="module-panel"><span className="eyebrow">STAND OUT IN THE INTERVIEW</span><h2>Build a credible product concept</h2><p>Turn a real company problem into a focused solution you can explain to an interviewer.</p><div className="input-card"><div className="label"><BriefcaseBusiness size={17}/> Company</div><input value={company}onChange={e=>setCompany(e.target.value)}placeholder="e.g. a target employer"/><div className="label"><Target size={17}/> Business problem</div><textarea value={problem}onChange={e=>setProblem(e.target.value)}placeholder="What problem should the company solve?"/><div className="label"><Sparkles size={17}/> Your idea <span>(optional)</span></div><textarea value={idea}onChange={e=>setIdea(e.target.value)}placeholder="Your initial solution idea…"/><button className="primary"disabled={loading||!problem.trim()}onClick={runDemo}>{loading?'Building concept…':<>Build my interview demo <ArrowRight size={18}/></>}</button></div>{error&&<p role="alert">{error}</p>}{data&&<div className="module-result"><span className="eyebrow">PROTOTYPE CONCEPT</span><h3>{data.title}</h3><p><b>{data.tagline}</b></p><p>{data.impact}</p></div>}</div>}

createRoot(document.getElementById('root')).render(<App/>);
