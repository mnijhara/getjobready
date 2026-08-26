(()=>{
  let started=false,lastTranscript='';
  const css=`.gjr-live-transcript{margin:14px 0;padding:14px 16px;border-radius:16px;background:#f8f7ff;border:1px solid #e6e2ff;text-align:left}.gjr-live-transcript .k{font-size:10px;font-weight:900;letter-spacing:.12em;color:#6855e8;text-transform:uppercase}.gjr-live-transcript p{margin:7px 0 0;color:#293044;font-size:14px;line-height:1.55;white-space:pre-wrap}.gjr-auto-note{font-size:12px;color:#727a8b;text-align:center;margin-top:8px}`;
  function style(){if(document.getElementById('gjr-auto-audio-css'))return;const s=document.createElement('style');s.id='gjr-auto-audio-css';s.textContent=css;document.head.appendChild(s)}
  function stage(){return document.querySelector('.voice-stage')||document.querySelector('[class*="voice-stage"]')}
  function findButton(s,re){return [...s.querySelectorAll('button')].find(b=>re.test((b.textContent||'').trim())&&b.offsetParent!==null)}
  function mount(){const s=stage();if(!s||s.dataset.gjrAuto)return;s.dataset.gjrAuto='1';style();
    if(!s.querySelector('.gjr-live-transcript')){const d=document.createElement('div');d.className='gjr-live-transcript';d.innerHTML='<div class="k">Live transcript</div><p data-gjr-transcript>Your spoken answers will appear here automatically.</p>';const anchor=s.querySelector('.voice-controls,.voice-actions')||s.lastElementChild;s.insertBefore(d,anchor||null)}
    const note=document.createElement('div');note.className='gjr-auto-note';note.textContent='After you start, there are no answer buttons. Speak naturally — Chrome captures and submits each answer automatically.';s.appendChild(note);
    s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(/start conversation|start interview|begin/i.test(b.textContent||'')){started=true;setTimeout(handsFree,900)}},true);
    const obs=new MutationObserver(()=>{if(started)handsFree()});obs.observe(s,{childList:true,subtree:true,characterData:true});
    function handsFree(){
      const b=findButton(s,/answer with your voice|speak answer|speak now/i);
      if(b){b.style.display='none';setTimeout(()=>{try{b.click()}catch{}},250)}
      const stop=findButton(s,/stop|end interview|pause/i);if(stop)stop.style.display='none';
      const ta=s.querySelector('textarea'),out=s.querySelector('[data-gjr-transcript]');if(ta&&out&&ta.value&&ta.value!==lastTranscript){lastTranscript=ta.value;out.textContent=ta.value}
    }
    const timer=setInterval(()=>{if(started)handsFree()},500);window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});setTimeout(mount,500);
})();
