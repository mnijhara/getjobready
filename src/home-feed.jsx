function installCareerFeed(){
  const root=document.getElementById('root');
  if(!root)return;
  const home=root.querySelector('.hero');
  const grid=root.querySelector('.module-grid');
  if(!home||!grid||root.querySelector('.gjr-career-feed'))return;
  const moduleButtons=[...grid.querySelectorAll('.module-card')];
  const careerButtons=[...home.querySelectorAll('.career-toggle button')];
  const activeCareer=careerButtons.find(b=>b.classList.contains('active'))?.textContent?.includes('Internship')?'internship':'job';
  const progressKey='gjr_progress_v1';
  const readProgress=()=>{try{return JSON.parse(sessionStorage.getItem(progressKey)||'{}')}catch{return {}}};
  const writeProgress=(key)=>{const p=readProgress();p[key]=true;sessionStorage.setItem(progressKey,JSON.stringify(p));};
  const feed=document.createElement('main');
  feed.className='feed gjr-career-feed';
  feed.innerHTML=`<style>
    .gjr-career-feed{padding-bottom:92px}
    .gjr-career-feed .feed-nav{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;width:min(92vw,430px);display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;border:1px solid rgba(23,30,49,.10);border-radius:22px;background:rgba(255,255,255,.92);box-shadow:0 14px 36px rgba(23,30,49,.16);backdrop-filter:blur(18px)}
    .gjr-career-feed .feed-nav button{border:0;background:transparent;border-radius:15px;padding:8px 5px;color:#667085;font:600 11px/1.1 system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
    .gjr-career-feed .feed-nav button strong{font-size:18px;line-height:1}
    .gjr-career-feed .feed-nav button.active{color:#171e31;background:#f1f3f8}
    .gjr-career-feed .progress-panel{margin:18px 0;padding:20px;border-radius:24px;background:#fff;border:1px solid rgba(23,30,49,.09);box-shadow:0 12px 30px rgba(23,30,49,.08)}
    .gjr-career-feed .progress-panel[hidden]{display:none}
    .gjr-career-feed .progress-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .gjr-career-feed .progress-score{font-size:28px;font-weight:800;color:#171e31}
    .gjr-career-feed .progress-track{height:8px;background:#edf0f5;border-radius:99px;overflow:hidden;margin:14px 0 16px}
    .gjr-career-feed .progress-fill{height:100%;width:0;background:#171e31;border-radius:inherit;transition:width .25s ease}
    .gjr-career-feed .progress-items{display:grid;gap:9px}
    .gjr-career-feed .progress-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #eef0f4;font:600 13px/1.2 system-ui,-apple-system,sans-serif;color:#344054}
    .gjr-career-feed .progress-item b{margin-left:auto;font-size:12px;color:#667085}
    @media (min-width:760px){.gjr-career-feed .feed-nav{position:sticky;bottom:16px;margin:24px auto 0;transform:none;left:auto}}
    .gjr-career-feed .feed-card.demo{background:#171e31;color:#fff}
    .gjr-career-feed .feed-card.demo p,.gjr-career-feed .feed-card.demo .feed-tag{color:rgba(255,255,255,.72)}
  </style>
  <section class="stories" aria-label="Career shortcuts">
    <button class="story add gjr-start"><b>+</b><span>Start</span></button>
    <div class="story"><i>🔥</i><span>7 day streak</span></div>
    <button class="story gjr-resume"><i>🎯</i><span>Match CV</span></button>
    <button class="story gjr-interview"><i>🎙️</i><span>Voice prep</span></button>
    <button class="story gjr-readiness"><i>💼</i><span>Corporate</span></button>
  </section>
  <section class="welcome-card"><div><span class="eyebrow">DAY 7 · KEEP GOING</span><h1>Let's get you<br><em>job-ready.</em></h1><p>Your degree opened the door. Your preparation gets you through it.</p></div><div class="streak"><strong>7</strong><span>🔥 days</span></div></section>
  <section class="career-strip"><button class="${activeCareer==='internship'?'active':''}" data-feed-career="internship">☀️ Internship</button><button class="${activeCareer==='job'?'active':''}" data-feed-career="job">💼 Full-time</button></section>
  <section class="section-head"><div><span class="eyebrow">YOUR CAREER FEED</span><h2>What are you working on?</h2></div></section>
  <div class="action-feed">
    <button class="feed-card purple gjr-resume"><div class="feed-icon">📄</div><div><span class="feed-tag">START HERE</span><h3>Get your CV matched</h3><p>Review your CV generally or match it to one specific JD.</p></div><b>→</b></button>
    <button class="feed-card dark gjr-interview"><div class="feed-icon">🎙️</div><div><span class="feed-tag">MOST POPULAR</span><h3>Talk to your AI interviewer</h3><p>It asks. You answer. It probes. No typing.</p></div><b>→</b></button>
    <button class="feed-card white gjr-readiness"><div class="feed-icon">🧠</div><div><span class="feed-tag">WORKPLACE</span><h3>Become corporate-ready</h3><p>Communication, feedback, priorities and confidence.</p></div><b>→</b></button>
    <button class="feed-card white gjr-ai"><div class="feed-icon">✨</div><div><span class="feed-tag">AI SKILL</span><h3>Learn AI that actually helps</h3><p>Research, writing, analysis and automation workflows.</p></div><b>→</b></button>
    <button class="feed-card demo gjr-demo"><div class="feed-icon">🚀</div><div><span class="feed-tag">STAND OUT</span><h3>Impress the interviewer</h3><p>Turn a real company problem into a polished product concept and demo.</p></div><b>→</b></button>
  </div>
  <section class="progress-panel" hidden aria-live="polite"><div class="progress-head"><div><span class="eyebrow">YOUR PROGRESS</span><h3>Build evidence, not just confidence.</h3><p>Complete the preparation tracks and build a stronger interview story.</p></div><strong class="progress-score">0%</strong></div><div class="progress-track"><div class="progress-fill"></div></div><div class="progress-items"></div></section>
  <section class="daily-card"><div><span class="eyebrow">TODAY'S MISSION</span><h3>Give me your 90-second answer.</h3><p>Practice your introduction before your next interview.</p></div><button class="round-btn gjr-interview">▶</button></section>
  <nav class="feed-nav" aria-label="Student navigation">
    <button class="active" data-feed-nav="home"><strong>⌂</strong><span>Home</span></button>
    <button data-feed-nav="prepare"><strong>▣</strong><span>Prepare</span></button>
    <button data-feed-nav="interview"><strong>◉</strong><span>Interview</span></button>
    <button data-feed-nav="progress"><strong>✦</strong><span>Progress</span></button>
  </nav>`;
  home.replaceWith(feed);
  grid.style.display='none';
  root.querySelector('.roadmap')?.remove();
  root.querySelector('footer')?.remove();
  const clickModule=i=>moduleButtons[i]?.click();
  const markAndOpen=(key,index)=>{writeProgress(key);clickModule(index)};
  feed.querySelectorAll('.gjr-start,.gjr-resume').forEach(b=>b.addEventListener('click',()=>markAndOpen('cv',0)));
  feed.querySelectorAll('.gjr-interview').forEach(b=>b.addEventListener('click',()=>markAndOpen('interview',1)));
  feed.querySelectorAll('.gjr-readiness').forEach(b=>b.addEventListener('click',()=>markAndOpen('corporate',2)));
  feed.querySelectorAll('.gjr-ai').forEach(b=>b.addEventListener('click',()=>markAndOpen('ai',3)));
  feed.querySelectorAll('.gjr-demo').forEach(b=>b.addEventListener('click',()=>markAndOpen('demo',4)));
  const setCareer=(value)=>{
    feed.querySelectorAll('[data-feed-career]').forEach(x=>x.classList.toggle('active',x.dataset.feedCareer===value));
    const target=careerButtons.find(x=>x.textContent.includes(value==='internship'?'Summer Internship':'Full-time'));
    target?.click();
  };
  feed.querySelectorAll('[data-feed-career]').forEach(b=>b.addEventListener('click',()=>setCareer(b.dataset.feedCareer)));
  const renderProgress=()=>{
    const p=readProgress();
    const items=[['cv','CV matched'],['interview','AI interview completed'],['corporate','Corporate readiness'],['ai','AI at work'],['demo','Stand-out demo']];
    const done=items.filter(([key])=>p[key]).length;
    const panel=feed.querySelector('.progress-panel');
    panel.querySelector('.progress-score').textContent=`${Math.round(done/items.length*100)}%`;
    panel.querySelector('.progress-fill').style.width=`${done/items.length*100}%`;
    panel.querySelector('.progress-items').innerHTML=items.map(([key,label])=>`<div class="progress-item"><span>${p[key]?'✓':'○'}</span><span>${label}</span><b>${p[key]?'Done':'Next'}</b></div>`).join('');
  };
  feed.querySelectorAll('[data-feed-nav]').forEach(b=>b.addEventListener('click',()=>{
    feed.querySelectorAll('[data-feed-nav]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const target=b.dataset.feedNav;
    const panel=feed.querySelector('.progress-panel');
    if(target==='home'){panel.hidden=true;feed.scrollTo({top:0,behavior:'smooth'});return}
    if(target==='prepare'){panel.hidden=true;markAndOpen('cv',0);return}
    if(target==='interview'){panel.hidden=true;markAndOpen('interview',1);return}
    if(target==='progress'){renderProgress();panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});}
  }));
}
const observer=new MutationObserver(()=>installCareerFeed());
observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
installCareerFeed();