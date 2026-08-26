(()=>{
  let started=false,lastTranscript='',silenceTimer=null,autoClickTimer=null,observed=null;
  const css=`.gjr-handsfree-note{font-size:12px;color:#727a8b;text-align:center;margin-top:8px}.gjr-handsfree-live{box-shadow:0 0 0 8px #6855e81a,0 0 32px #6855e844!important}`;
  function style(){if(document.getElementById('gjr-auto-audio-css'))return;const s=document.createElement('style');s.id='gjr-auto-audio-css';s.textContent=css;document.head.appendChild(s)}
  const stage=()=>document.querySelector('.voice-panel');
  const buttons=(s,re)=>[...s.querySelectorAll('button')].filter(b=>re.test((b.textContent||'').trim()));
  const anyButton=(s,re)=>buttons(s,re)[0];
  function mount(){const s=stage();if(!s||observed===s)return;observed=s;style();
    if(!s.querySelector('.gjr-handsfree-note')){const note=document.createElement('div');note.className='gjr-handsfree-note';note.textContent='Hands-free interview: speak naturally. Your answer is captured automatically after a short pause.';s.appendChild(note)}
    s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(/start interview|start conversation|begin/i.test(b.textContent||'')){started=true;setTimeout(handsFree,300)}},true);
    const obs=new MutationObserver(()=>{if(started)handsFree()});obs.observe(s,{childList:true,subtree:true,characterData:true});
    const timer=setInterval(()=>{if(started)handsFree()},250);
    window.addEventListener('beforeunload',()=>{clearInterval(timer);clearTimeout(silenceTimer);clearTimeout(autoClickTimer);obs.disconnect()},{once:true});
    function syncTranscript(){
      const state=(s.querySelector('.voice-state')?.textContent||'').trim().toLowerCase();
      const value=(s.querySelector('.transcript p')?.textContent||'').trim();
      if(state!=='listening'){clearTimeout(silenceTimer);return}
      if(value&&value!==lastTranscript){lastTranscript=value;clearTimeout(silenceTimer);silenceTimer=setTimeout(()=>finishAnswer(s),1800)}
    }
    function finishAnswer(s){const done=anyButton(s,/done speaking|stop|end answer/i);if(done){try{done.click()}catch{}}}
    function hideConversationButtons(){
      const feedback=anyButton(s,/see feedback/i);
      [...s.querySelectorAll('button')].forEach(b=>{b.style.display=feedback&&b===feedback?'':'none'});
    }
    function handsFree(){
      const state=(s.querySelector('.voice-state')?.textContent||'').trim().toLowerCase();
      const feedback=anyButton(s,/see feedback/i);
      if(/interview complete/i.test(state)||feedback){clearTimeout(autoClickTimer);return}
      hideConversationButtons();
      syncTranscript();
      const orb=s.querySelector('.voice-orb');orb?.classList.toggle('gjr-handsfree-live',state.includes('listening'));
      const answerButton=anyButton(s,/answer with your voice|speak answer|speak now/i);
      if(started&&answerButton&&!autoClickTimer&&!/speaking|thinking|listening|evaluating/i.test(state)){
        autoClickTimer=setTimeout(()=>{autoClickTimer=null;try{answerButton.click()}catch{}},250)
      }
    }
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
  setTimeout(mount,400);
})();
