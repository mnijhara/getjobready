function installCareerFeed(){
  const root=document.getElementById('root');
  if(!root)return;
  const home=root.querySelector('.hero');
  const grid=root.querySelector('.module-grid');
  if(!home||!grid||root.querySelector('.gjr-career-feed'))return;
  const moduleButtons=[...grid.querySelectorAll('.module-card')];
  const careerButtons=[...home.querySelectorAll('.career-toggle button')];
  const activeCareer=careerButtons.find(b=>b.classList.contains('active'))?.textContent?.includes('Internship')?'internship':'job';
  const feed=document.createElement('main');
  feed.className='feed gjr-career-feed';
  feed.innerHTML=`<style>
    .gjr-career-feed{padding-bottom:92px}
    .gjr-career-feed .feed-nav{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;width:min(92vw,430px);display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;border:1px solid rgba(23,30,49,.10);border-radius:22px;background:rgba(255,255,255,.92);box-shadow:0 14px 36px rgba(23,30,49,.16);backdrop-filter:blur(18px)}
    .gjr-career-feed .feed-nav button{border:0;background:transparent;border-radius:15px;padding:8px 5px;color:#667085;font:600 11px/1.1 system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
    .gjr-career-feed .feed-nav button strong{font-size:18px;line-height:1}
    .gjr-career-feed .feed-nav button.active{color:#171e31;background:#f1f3f8}
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
  feed.querySelectorAll('.gjr-start,.gjr-resume').forEach(b=>b.addEventListener('click',()=>clickModule(0)));
  feed.querySelectorAll('.gjr-interview').forEach(b=>b.addEventListener('click',()=>clickModule(1)));
  feed.querySelectorAll('.gjr-readiness').forEach(b=>b.addEventListener('click',()=>clickModule(2)));
  feed.querySelectorAll('.gjr-ai').forEach(b=>b.addEventListener('click',()=>clickModule(3)));
  feed.querySelectorAll('.gjr-demo').forEach(b=>b.addEventListener('click',()=>clickModule(4)));
  const setCareer=(value)=>{
    feed.querySelectorAll('[data-feed-career]').forEach(x=>x.classList.toggle('active',x.dataset.feedCareer===value));
    const target=careerButtons.find(x=>x.textContent.includes(value==='internship'?'Summer Internship':'Full-time'));
    target?.click();
  };
  feed.querySelectorAll('[data-feed-career]').forEach(b=>b.addEventListener('click',()=>setCareer(b.dataset.feedCareer)));
  feed.querySelectorAll('[data-feed-nav]').forEach(b=>b.addEventListener('click',()=>{
    feed.querySelectorAll('[data-feed-nav]').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const target=b.dataset.feedNav;
    if(target==='home')feed.scrollTo({top:0,behavior:'smooth'});
    if(target==='prepare')clickModule(0);
    if(target==='interview')clickModule(1);
    if(target==='progress')clickModule(2);
  }));
}
const observer=new MutationObserver(()=>installCareerFeed());
observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
installCareerFeed();