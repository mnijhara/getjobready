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
  feed.innerHTML=`<section class="stories" aria-label="Career shortcuts">
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
  </div>
  <section class="daily-card"><div><span class="eyebrow">TODAY'S MISSION</span><h3>Give me your 90-second answer.</h3><p>Practice your introduction before your next interview.</p></div><button class="round-btn gjr-interview">▶</button></section>`;
  home.replaceWith(feed);
  grid.remove();
  root.querySelector('.roadmap')?.remove();
  root.querySelector('footer')?.remove();
  const clickModule=i=>moduleButtons[i]?.click();
  feed.querySelectorAll('.gjr-start,.gjr-resume').forEach(b=>b.addEventListener('click',()=>clickModule(0)));
  feed.querySelectorAll('.gjr-interview').forEach(b=>b.addEventListener('click',()=>clickModule(1)));
  feed.querySelectorAll('.gjr-readiness').forEach(b=>b.addEventListener('click',()=>clickModule(2)));
  feed.querySelectorAll('.gjr-ai').forEach(b=>b.addEventListener('click',()=>clickModule(3)));
  feed.querySelectorAll('[data-feed-career]').forEach(b=>b.addEventListener('click',()=>careerButtons.find(x=>x.textContent.includes(b.dataset.feedCareer==='internship'?'Summer Internship':'Full-time'))?.click()));
}
const observer=new MutationObserver(()=>installCareerFeed());
observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});
installCareerFeed();
