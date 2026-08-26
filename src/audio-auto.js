(()=>{
  let active=null, recognition=null, started=false, transcript='';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const css=`.gjr-live-transcript{margin:14px 0;padding:14px 16px;border-radius:16px;background:#f8f7ff;border:1px solid #e6e2ff;text-align:left}.gjr-live-transcript .k{font-size:10px;font-weight:900;letter-spacing:.12em;color:#6855e8;text-transform:uppercase}.gjr-live-transcript p{margin:7px 0 0;color:#293044;font-size:14px;line-height:1.55;white-space:pre-wrap}.gjr-listening{box-shadow:0 0 0 10px #6855e81a,0 0 45px #6855e855!important;animation:gjrPulse 1.1s infinite}.gjr-auto-note{font-size:12px;color:#727a8b;text-align:center;margin-top:8px}@keyframes gjrPulse{50%{transform:scale(1.04)}}`;
  function style(){if(document.getElementById('gjr-auto-audio-css'))return;const s=document.createElement('style');s.id='gjr-auto-audio-css';s.textContent=css;document.head.appendChild(s)}
  function stage(){return document.querySelector('.voice-stage')||document.querySelector('[class*="voice-stage"]')}
  function addTranscript(s){if(!s.querySelector('.gjr-live-transcript')){const d=document.createElement('div');d.className='gjr-live-transcript';d.innerHTML='<div class="k">Live transcript</div><p data-gjr-transcript>Your answer will appear here automatically.</p>';s.appendChild(d)}return s.querySelector('[data-gjr-transcript]')}
  function buttons(s){return [...s.querySelectorAll('button')].filter(b=>b.offsetParent!==null)}
  function startRecognition(s){if(!SR||recognition)return;transcript='';const out=addTranscript(s);out.textContent='Listening…';const orb=s.querySelector('.voice-orb')||s.querySelector('.ai-avatar');orb?.classList.add('gjr-listening');try{recognition=new SR();recognition.lang='en-IN';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1}catch{return}
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)transcript+=(t+' ');else interim+=t;}out.textContent=(transcript+' '+interim).trim()||'Listening…'};
    recognition.onerror=()=>{recognition=null;orb?.classList.remove('gjr-listening');out.textContent='I could not hear that. Please continue speaking naturally.';setTimeout(()=>startRecognition(s),600)};
    recognition.onend=()=>{recognition=null;orb?.classList.remove('gjr-listening');const answer=transcript.trim();if(answer){out.textContent=answer;const ta=s.querySelector('textarea');if(ta){ta.value=answer;ta.dispatchEvent(new Event('input',{bubbles:true}));ta.dispatchEvent(new Event('change',{bubbles:true}))}const submit=[...s.querySelectorAll('button')].find(b=>/submit|continue|send|next/i.test(b.textContent||''));if(submit)setTimeout(()=>submit.click(),250)}};
    try{recognition.start()}catch{recognition=null}
  }
  function mount(){const s=stage();if(!s||s.dataset.gjrAuto)return;s.dataset.gjrAuto='1';style();addTranscript(s);const note=document.createElement('div');note.className='gjr-auto-note';note.textContent='Once the interview starts, just speak. Your answer is captured automatically and the transcript stays visible.';s.appendChild(note);
    s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||started)return;if(/start|answer with your voice|begin/i.test(b.textContent||'')){started=true;setTimeout(()=>{buttons(s).forEach(x=>{if(x!==b)x.style.display='none'});b.style.display='none';startRecognition(s)},700)}},true);
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});setTimeout(mount,500);
})();
