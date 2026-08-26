(()=>{
  let started=false,lastTranscript='',silenceTimer=null,autoClickTimer=null;
  const css=`.gjr-live-transcript{margin:14px 0;padding:14px 16px;border-radius:16px;background:#f8f7ff;border:1px solid #e6e2ff;text-align:left}.gjr-live-transcript .k{font-size:10px;font-weight:900;letter-spacing:.12em;color:#6855e8;text-transform:uppercase}.gjr-live-transcript p{margin:7px 0 0;color:#293044;font-size:14px;line-height:1.55;white-space:pre-wrap}.gjr-handsfree-note{font-size:12px;color:#727a8b;text-align:center;margin-top:8px}.gjr-handsfree-live{box-shadow:0 0 0 8px #6855e81a,0 0 32px #6855e844!important}`;
  function style(){if(document.getElementById('gjr-auto-audio-css'))return;const s=document.createElement('style');s.id='gjr-auto-audio-css';s.textContent=css;document.head.appendChild(s)}
  function stage(){return document.querySelector('.voice-panel')||document.querySelector('.voice-stage')||document.querySelector('[class*="voice-stage"]')}
  function visibleButton(s,re){return [...s.querySelectorAll('button')].find(b=>re.test((b.textContent||'').trim())&&b.offsetParent!==null)}
  function anyButton(s,re){return [...s.querySelectorAll('button')].find(b=>re.test((b.textContent||'').trim()))}
  function mount(){const s=stage();if(!s||s.dataset.gjrAuto)return;s.dataset.gjrAuto='1';style();
    if(!s.querySelector('.gjr-live-transcript')){const d=document.createElement('div');d.className='gjr-live-transcript';d.innerHTML='<div class="k">Live transcript</div><p data-gjr-transcript>Your spoken answers will appear here automatically.</p>';const anchor=s.querySelector('.voice-controls,.voice-actions')||s.lastElementChild;s.insertBefore(d,anchor||null)}
    if(!s.querySelector('.gjr-handsfree-note')){const note=document.createElement('div');note.className='gjr-handsfree-note';note.textContent='Hands-free interview: speak naturally. Your answer stops automatically after a short pause, then the AI continues.';s.appendChild(note)}
    s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(/start conversation|start interview|begin/i.test(b.textContent||'')){started=true;setTimeout(handsFree,350)}},true);
    const obs=new MutationObserver(()=>{if(started)handsFree()});obs.observe(s,{childList:true,subtree:true,characterData:true});
    function hideDuringConversation(){
      const done=anyButton(s,/see feedback/i);
      const buttons=[...s.querySelectorAll('button')];
      buttons.forEach(b=>{if(!done||!b.isSameNode(done))b.style.display='none'});
    }
    function syncTranscript(){
      const ta=s.querySelector('textarea'),out=s.querySelector('[data-gjr-transcript]');
      if(!ta||!out)return;
      const value=(ta.value||'').trim();
      if(value&&value!==lastTranscript){lastTranscript=value;out.textContent=value;clearTimeout(silenceTimer);silenceTimer=setTimeout(()=>finishAnswer(s),1800)}
    }
    function finishAnswer(s){const stop=anyButton(s,/done speaking|stop|end answer/i);if(stop){try{stop.click()}catch{}}}
    function handsFree(){
      syncTranscript();
      const state=s.querySelector('.voice-state')?.textContent||'';
      const answerButton=visibleButton(s,/answer with your voice|speak answer|speak now/i);
      const doneButton=anyButton(s,/done speaking|stop|end answer/i);
      const feedback=visibleButton(s,/see feedback/i);
      if(/interview complete/i.test(state)||feedback){return}
      hideDuringConversation();
      const orb=s.querySelector('.voice-orb');orb?.classList.toggle('gjr-handsfree-live',/listening/i.test(state));
      if(answerButton&&!autoClickTimer&&!/speaking|thinking/i.test(state)){
        autoClickTimer=setTimeout(()=>{autoClickTimer=null;try{answerButton.click()}catch{}},250)
      }
      if(doneButton)doneButton.style.display='none';
    }
    const timer=setInterval(()=>{if(started)handsFree()},250);
    window.addEventListener('beforeunload',()=>{clearInterval(timer);clearTimeout(silenceTimer);clearTimeout(autoClickTimer)},{once:true});
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});setTimeout(mount,400);
})();
