import './home-feed-v3.css';

let installed=false;
function installCareerFeedV2(){
  const root=document.getElementById('root'); if(!root||installed)return;
  const home=root.querySelector('.hero'),grid=root.querySelector('.module-grid');
  if(!home||!grid)return;
  installed=true;
  const moduleButtons=[...grid.querySelectorAll('.module-card')];
  const originalCareerButtons=[...home.querySelectorAll('.career-toggle button')];
  const progressKey='gjr_progress_v1';
  const streakKey='gjr_streak_v1';
  const readProgress=()=>{try{return JSON.parse(sessionStorage.getItem(progressKey)||'{}')||{}}catch{return {}}};
  const readStreak=()=>{try{return JSON.parse(localStorage.getItem(streakKey)||'{}')||{}}catch{return {}}};
  const dateKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const touchStreak=()=>{
    const today=dateKey(),previous=readStreak();
    if(previous.last===today)return previous.count||1;
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const count=previous.last===dateKey(yesterday)?(previous.count||1)+1:1;
    try{localStorage.setItem(streakKey,JSON.stringify({count,last:today}));}catch{}
    return count;
  };
  const currentStreak=()=>readStreak().count||0;
  const writeProgress=(key,status='started')=>{const p=readProgress();p[key]=status;sessionStorage.setItem(progressKey,JSON.stringify(p));touchStreak();window.dispatchEvent(new CustomEvent('gjr-progress',{detail:{key,status}}));};
  const dialog=(title,text,items)=>{
    const m=document.createElement('div');m.className='gjr-how-modal';
    m.innerHTML=`<div class="gjr-how-card"><button class="gjr-how-close" aria-label="Close">×</button><span class="eyebrow">GETJOBREADY</span><h2>${title}</h2><p>${text}</p><div class="gjr-how-list"></div></div>`;
    document.body.appendChild(m);const list=m.querySelector('.gjr-how-list');
    items.forEach((item,i)=>{const b=document.createElement('button');b.className='gjr-how-step';b.innerHTML=`<b>0${i+1}</b><div><strong>${item.label}</strong><span>${item.text||''}</span></div>`;b.onclick=()=>{m.remove();item.onClick?.()};list.appendChild(b)});
    const close=()=>m.remove();m.querySelector('.gjr-how-close').onclick=close;m.onclick=e=>{if(e.target===m)close()};
  };
  const openPrep=()=>dialog('How do you want to prepare?','Start with a general CV review, or add one exact job description for role-specific preparation.',[
    {label:'General CV review',text:'No JD needed · interview questions based only on your CV.',onClick:()=>openWorkspace('general')},
    {label:'CV + specific JD',text:'Upload one JD · role fit, gaps, plan and targeted interview.',onClick:()=>openWorkspace('specific')}
  ]);
  const openWorkspace=mode=>{writeProgress('cv','started');moduleButtons[0]?.click();setTimeout(()=>{document.querySelectorAll('.mode-pills button')[mode==='general'?0:1]?.click();window.scrollTo({top:0,behavior:'smooth'})},120)};
  const openInterview=()=>{const hasCV=sessionStorage.getItem('gjr_cv_text')||sessionStorage.getItem('gjr_cv_data');if(hasCV){writeProgress('interview','started');moduleButtons[1]?.click();return;}dialog('Start with your CV','Your AI interview is grounded in your real experience. Upload your CV first, then choose the interview type.',[
    {label:'General CV interview',text:'Questions based only on your CV.',onClick:()=>openWorkspace('general')},
    {label:'CV + JD interview',text:'Questions based on your CV and the target role.',onClick:()=>openWorkspace('specific')}
  ])};
  const openModule=(key,index,title,text)=>{writeProgress(key,'started');if(index<2){moduleButtons[index]?.click();return;}if(typeof window.gjrOpenModule==='function'){window.gjrOpenModule(title);return;}dialog(title,text,[{label:'Back to preparation',text:'Continue your core CV and interview journey.'}])};
  const feed=document.createElement('main');feed.className='feed gjr-career-feed';
  feed.innerHTML=`<section class="stories" aria-label="Career shortcuts">
    <button type="button" class="story add gjr-start"><b>+</b><span>Start</span></button>
    <button type="button" class="story gjr-streak"><i>🔥</i><span>Start your streak</span></button>
    <button type="button" class="story gjr-resume"><i>🎯</i><span>Match CV</span></button>
    <button type="button" class="story gjr-interview"><i>🎙️</i><span>Voice prep</span></button>
    <button type="button" class="story gjr-readiness"><i>💼</i><span>Corporate</span></button>
  </section>
  <section class="welcome-card"><div><span class="eyebrow">FULL-TIME TRACK · BUILD YOUR STREAK</span><h1>Let's get you<br><em>job-ready.</em></h1><p>Turn your CV into a role-ready story, practise the interview and build evidence you can take into the room.</p></div><div class="streak"><strong>0</strong><span>🔥 days</span></div></section>
  <section class="career-strip" role="tablist" aria-label="Career track"><button type="button" data-feed-career="internship">☀️ Internship</button><button type="button" class="active" data-feed-career="job">💼 Full-time</button></section>
  <section class="section-head"><div><span class="eyebrow">YOUR CAREER FEED</span><h2>What are you working on?</h2></div></section>
  <div class="action-feed">
    <button type="button" class="feed-card purple gjr-resume"><div class="feed-icon">📄</div><div><span class="feed-tag">START HERE</span><h3>Get your CV matched</h3><p>Choose a general CV review or match it to one specific JD.</p></div><b>→</b></button>
    <button type="button" class="feed-card dark gjr-interview"><div class="feed-icon">🎙️</div><div><span class="feed-tag">MOST POPULAR</span><h3>Talk to your AI interviewer</h3><p>It asks. You answer. It probes. No typing.</p></div><b>→</b></button>
    <button type="button" class="feed-card white gjr-readiness"><div class="feed-icon">🧠</div><div><span class="feed-tag">WORKPLACE</span><h3>Become corporate-ready</h3><p>Communication, feedback, priorities and confidence.</p></div><b>→</b></button>
    <button type="button" class="feed-card white gjr-ai"><div class="feed-icon">✨</div><div><span class="feed-tag">AI SKILL</span><h3>Learn AI that actually helps</h3><p>Research, writing, analysis and automation workflows.</p></div><b>→</b></button>
    <button type="button" class="feed-card demo gjr-demo"><div class="feed-icon">🚀</div><div><span class="feed-tag">STAND OUT</span><h3>Impress the interviewer</h3><p>Turn a real company problem into a polished product concept and demo.</p></div><b>→</b></button>
  </div>
  <section class="progress-panel" hidden aria-live="polite"><div class="progress-head"><div><span class="eyebrow">YOUR PROGRESS</span><h3>Build evidence, not just confidence.</h3><p></p></div><strong class="progress-score">0%</strong></div><div class="progress-track"><div class="progress-fill"></div></div><div class="progress-items"></div></section>
  <section class="daily-card"><div><span class="eyebrow">TODAY'S MISSION</span><h3>Give me your 90-second answer.</h3><p>Practice your introduction before your next interview.</p></div><button type="button" class="round-btn gjr-interview" aria-label="Start today's mission">▶</button></section>
  <nav class="feed-nav" aria-label="Student navigation"><button type="button" class="active" data-feed-nav="home"><strong>⌂</strong><span>Home</span></button><button type="button" data-feed-nav="prepare"><strong>▣</strong><span>Prepare</span></button><button type="button" data-feed-nav="interview"><strong>◉</strong><span>Interview</span></button><button type="button" data-feed-nav="progress"><strong>✦</strong><span>Progress</span></button></nav>`;
  home.replaceWith(feed);grid.style.display='none';root.querySelector('.roadmap')?.remove();

  const renderStreak=()=>{
    const count=currentStreak();
    const label=count?`${count} day streak`:'Start your streak';
    feed.querySelector('.gjr-streak span').textContent=label;
    feed.querySelector('.streak strong').textContent=String(count);
    feed.querySelector('.welcome-card .eyebrow').textContent=`${sessionStorage.getItem('gjr_career')==='internship'?'INTERNSHIP':'FULL-TIME'} TRACK · ${count?`${count} DAY STREAK`:'BUILD YOUR STREAK'}`;
  };
  const setCareer=value=>{
    feed.querySelectorAll('[data-feed-career]').forEach(x=>{x.classList.toggle('active',x.dataset.feedCareer===value);x.setAttribute('aria-selected',String(x.dataset.feedCareer===value));});
    const target=originalCareerButtons.find(x=>x.textContent.includes(value==='internship'?'Summer Internship':'Full-time Job'));target?.click();
    const internship=value==='internship';
    feed.querySelector('.welcome-card p').textContent=internship?'Build a strong campus-to-internship story, sharpen your CV and practise the questions recruiters ask interns.':'Turn your CV into a role-ready story, practise the interview and build evidence you can take into the room.';
    feed.querySelector('.section-head h2').textContent=internship?'What are you preparing for?':'What are you working on?';
    feed.querySelector('.feed-card.dark p').textContent=internship?'Practise internship questions grounded in your CV.':'Practise a role-specific conversation grounded in your CV + JD.';
    feed.querySelector('.daily-card h3').textContent=internship?'Record your 90-second internship pitch.':'Give me your 90-second answer.';
    renderStreak();
  };
  const renderProgress=()=>{const p=readProgress(),items=[['cv','CV preparation'],['interview','AI interview'],['corporate','Corporate readiness'],['ai','AI at Work'],['demo','Stand-out demo']],done=items.filter(([k])=>p[k]==='completed').length,started=items.filter(([k])=>p[k]&&p[k]!=='completed').length,panel=feed.querySelector('.progress-panel');panel.querySelector('.progress-score').textContent=`${Math.round(done/items.length*100)}%`;panel.querySelector('.progress-fill').style.width=`${done/items.length*100}%`;panel.querySelector('.progress-head p').textContent=`${done} of ${items.length} activities completed${started?` · ${started} started`:''}.`;panel.querySelector('.progress-items').innerHTML=items.map(([k,l])=>`<div class="progress-item"><span>${p[k]==='completed'?'✓':p[k]?'•':'○'}</span><span>${l}</span><b>${p[k]==='completed'?'Done':p[k]?'Started':'Next'}</b></div>`).join('')};

  feed.querySelectorAll('.gjr-start,.gjr-resume').forEach(b=>b.addEventListener('click',openPrep));
  feed.querySelectorAll('.gjr-interview').forEach(b=>b.addEventListener('click',openInterview));
  feed.querySelectorAll('.gjr-readiness').forEach(b=>b.addEventListener('click',()=>openModule('corporate',2,'Corporate Ready','Practise communication, feedback, priorities and workplace confidence.')));
  feed.querySelectorAll('.gjr-ai').forEach(b=>b.addEventListener('click',()=>openModule('ai',3,'AI at Work','Learn practical AI workflows for research, writing, analysis and automation.')));
  feed.querySelectorAll('.gjr-demo').forEach(b=>b.addEventListener('click',()=>openModule('demo',4,'Impress the Interviewer','Turn a real company problem into a concise product concept and demo.')));
  feed.querySelectorAll('[data-feed-career]').forEach(b=>b.addEventListener('click',()=>{sessionStorage.setItem('gjr_career',b.dataset.feedCareer);setCareer(b.dataset.feedCareer)}));
  feed.querySelector('.gjr-streak').addEventListener('click',()=>dialog(currentStreak()?`${currentStreak()}-day streak`:'Start your streak',currentStreak()?'Keep your preparation moving by completing one small task today.':'Complete one preparation task today to start your streak.',[{label:"Today's mission",text:'Record your 90-second answer.',onClick:openInterview}]));
  feed.querySelectorAll('[data-feed-nav]').forEach(b=>b.addEventListener('click',()=>{feed.querySelectorAll('[data-feed-nav]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.feedNav,p=feed.querySelector('.progress-panel');if(t==='home'){p.hidden=true;window.scrollTo({top:0,behavior:'smooth'})}else if(t==='prepare'){p.hidden=true;openPrep()}else if(t==='interview'){p.hidden=true;openInterview()}else{renderProgress();p.hidden=false;p.scrollIntoView({behavior:'smooth',block:'start'})}}));

  const ghost=document.querySelector('header .ghost');ghost?.addEventListener('click',()=>dialog('How GetJobReady works','A simple path from your CV to a confident, role-ready interview.',[
    {label:'1 · Match',text:'Review your CV generally or match it to one exact JD.',onClick:openPrep},
    {label:'2 · Talk',text:'Practise through a live AI audio interview grounded in your preparation.',onClick:openInterview},
    {label:'3 · Improve',text:'Use adaptive feedback to strengthen your next answer.'}
  ]));

  window.addEventListener('gjr-progress',()=>{renderProgress();renderStreak()});
  setCareer(sessionStorage.getItem('gjr_career')||'job');
  renderStreak();
}

const observer=new MutationObserver(()=>{if(!installed)installCareerFeedV2()});
observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
installCareerFeedV2();
