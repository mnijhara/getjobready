(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let enhancedInterview = null;
  let recognition = null;
  let listening = false;
  let speaking = false;
  let active = false;

  const style = document.createElement('style');
  style.textContent = `
    .adaptive-panel{margin-top:16px;border:1px solid #ded9ff;background:linear-gradient(135deg,#f7f5ff,#fff);border-radius:20px;padding:18px}
    .adaptive-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.adaptive-head b{font:800 15px Manrope}.adaptive-head small{color:#737b8c}
    .adaptive-status{margin:13px 0;color:#596274;font-size:13px}.adaptive-status.live{color:#5b49c8;font-weight:700}
    .adaptive-actions{display:flex;gap:8px;flex-wrap:wrap}.adaptive-actions button{border:1px solid #d9d6eb;background:#fff;border-radius:11px;padding:10px 13px;font-weight:800;cursor:pointer}.adaptive-actions .primary{background:#6855e8;color:#fff;border-color:#6855e8}
    .adaptive-transcript{display:none;margin-top:12px;padding:10px 12px;background:#fff;border-radius:11px;color:#687183;font-size:12px;border:1px solid #eceaf5}
  `;
  document.head.appendChild(style);

  const question = () => document.querySelector('.question-card h2')?.textContent?.trim() || '';
  const answer = () => document.querySelector('#answer');
  const submit = () => document.querySelector('#submitAnswer');
  const setStatus = (text, live=false) => { const e=document.querySelector('[data-adaptive-status]'); if(e){e.textContent=text;e.className='adaptive-status'+(live?' live':'');} };
  const setTranscript = text => { const a=answer(); if(a)a.value=text; const e=document.querySelector('[data-adaptive-transcript]'); if(e){e.textContent=text;e.style.display=text?'block':'none';} };

  function stopSpeak(){try{speechSynthesis.cancel()}catch{} speaking=false;}
  function speak(text,done){
    if(!text || !('speechSynthesis' in window)){done?.();return;}
    stopSpeak(); const u=new SpeechSynthesisUtterance(text); u.lang='en-IN';u.rate=.95;u.pitch=1;
    u.onstart=()=>{speaking=true;setStatus('AI interviewer is speaking…',true)};
    u.onend=()=>{speaking=false;done?.()};u.onerror=()=>{speaking=false;done?.()};speechSynthesis.speak(u);
  }
  function listen(){
    if(!SR){setStatus('Voice input needs Chrome or Edge.');return;}
    if(listening||speaking)return;
    recognition=new SR();recognition.lang='en-IN';recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
    let finalText='';listening=true;setStatus('Listening… answer naturally.',true);
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)finalText+=(t+' ');else interim+=t;}setTranscript((finalText+' '+interim).trim());};
    recognition.onerror=e=>{listening=false;setStatus(e.error==='not-allowed'?'Microphone permission is blocked.':'I could not hear that clearly. Try again.');};
    recognition.onend=()=>{listening=false;const text=(answer()?.value||'').trim();if(active&&text){setStatus('Answer captured. Thinking about the best follow-up…',true);setTimeout(()=>submit()?.click(),350)}else if(text)setStatus('Answer captured. Review it or submit.');};
    try{recognition.start()}catch{listening=false;}
  }
  function ask(){const q=question();if(!q)return;speak(q,()=>{if(active)setTimeout(listen,250)});}
  function start(){active=true;const a=answer();if(a)a.value='';setStatus('Starting your adaptive voice interview…',true);ask();}
  function pause(){active=false;stopSpeak();try{recognition?.stop()}catch{};listening=false;setStatus('Interview paused.');}
  function enhance(){
    const interview=document.querySelector('.interview');if(!interview||enhancedInterview===interview)return;enhancedInterview=interview;
    const panel=document.createElement('section');panel.className='adaptive-panel';panel.innerHTML=`<div class="adaptive-head"><div><b>🎙️ Adaptive voice interview</b><br><small>The interviewer listens to your answer and chooses what to ask next.</small></div></div><div class="adaptive-status" data-adaptive-status>Ready.</div><div class="adaptive-actions"><button class="primary" data-start>▶ Start conversation</button><button data-ask>🔊 Hear question</button><button data-mic>🎤 Speak answer</button><button data-pause>■ Pause</button></div><div class="adaptive-transcript" data-adaptive-transcript></div>`;
    interview.appendChild(panel);
    panel.querySelector('[data-start]').onclick=start;panel.querySelector('[data-ask]').onclick=()=>ask();panel.querySelector('[data-mic]').onclick=listen;panel.querySelector('[data-pause]').onclick=pause;
    setTimeout(ask,400);
  }
  new MutationObserver(()=>{enhancedInterview=null;setTimeout(enhance,0)}).observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
