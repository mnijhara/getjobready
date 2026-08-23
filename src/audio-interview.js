(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let mounted = null;
  let recognition = null;
  let speaking = false;
  let listening = false;
  let running = false;
  let processing = false;
  let turn = 1;
  const maxTurns = 7;
  let question = '';
  let answers = [];
  let transcript = '';
  let currentAudio = null;

  const style = document.createElement('style');
  style.textContent = `
  .voice-stage{margin-top:18px;background:linear-gradient(145deg,#121a2b,#1b2540);color:#fff;border-radius:28px;padding:22px;box-shadow:0 20px 55px #10182725;overflow:hidden}.voice-stage *{box-sizing:border-box}.voice-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.voice-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#a9a0ff}.voice-title{font:800 19px Manrope,system-ui,sans-serif;margin-top:4px}.voice-counter{font-size:12px;color:#c3c9d6;background:#ffffff10;padding:7px 10px;border-radius:999px}.voice-orb-wrap{display:grid;place-items:center;padding:24px 0 18px}.voice-orb{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#9b91ff,#6855e8 55%,#5142c5);box-shadow:0 0 0 12px #6855e820,0 0 55px #6855e855}.voice-orb.live{animation:voicePulse 1.25s infinite}.voice-orb.listening{background:radial-gradient(circle at 35% 30%,#72f0bb,#1da06d 60%,#157c55);box-shadow:0 0 0 12px #2dd18b18,0 0 55px #2dd18b44}.voice-orb.thinking{animation:voiceThink 1s infinite}.voice-status{text-align:center;font-size:13px;color:#d9deea;min-height:20px}.voice-question{margin:18px 0;padding:18px;border:1px solid #ffffff12;background:#ffffff08;border-radius:18px}.voice-question small{color:#9da6b8;font-size:11px}.voice-question h2{font:800 25px/1.2 Manrope,system-ui,sans-serif;letter-spacing:-.03em;margin:9px 0 0}.voice-transcript{margin-top:12px;padding:13px 14px;border-radius:14px;background:#0c1322;color:#d7dce7;font-size:13px;line-height:1.55;min-height:45px}.voice-transcript:empty{display:none}.voice-wave{height:28px;display:flex;align-items:center;justify-content:center;gap:4px;margin:12px 0}.voice-wave i{width:3px;height:7px;border-radius:5px;background:#8276ef}.voice-wave.live i{animation:voiceWave .8s ease-in-out infinite alternate}.voice-wave i:nth-child(2){animation-delay:.08s}.voice-wave i:nth-child(3){animation-delay:.16s}.voice-wave i:nth-child(4){animation-delay:.24s}.voice-wave i:nth-child(5){animation-delay:.32s}.voice-wave i:nth-child(6){animation-delay:.4s}.voice-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.voice-action{border:1px solid #ffffff1b;background:#ffffff0b;color:#fff;border-radius:14px;padding:13px 12px;font-weight:800;cursor:pointer}.voice-action.primary{background:#6855e8;border-color:#6855e8}.voice-action:disabled{opacity:.4;cursor:not-allowed}.voice-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;color:#9ea7b8;font-size:11px}.voice-stop{border:0;background:transparent;color:#b9c0cd;font-weight:700;cursor:pointer}.voice-error{margin-top:10px;padding:10px 12px;background:#8d2d3b22;border:1px solid #d35b6b55;border-radius:12px;color:#ffb7c0;font-size:12px}.voice-complete{margin-top:15px;padding:16px;background:#ffffff09;border:1px solid #ffffff12;border-radius:16px}.voice-complete b{font-family:Manrope}.voice-complete p{color:#bfc6d3;font-size:12px;margin:5px 0 0}.voice-score{font:800 30px Manrope;color:#9f96ff}.voice-text-fallback{margin-top:14px;text-align:center;font-size:11px;color:#8f98aa}.voice-text-fallback a{color:#aaa2ff;text-decoration:underline;cursor:pointer}@keyframes voicePulse{50%{transform:scale(1.07);box-shadow:0 0 0 17px #6855e820,0 0 70px #6855e855}}@keyframes voiceThink{50%{transform:scale(.94);opacity:.72}}@keyframes voiceWave{to{height:24px}}@media(max-width:520px){.voice-stage{padding:17px;border-radius:23px}.voice-question h2{font-size:22px}.voice-actions{grid-template-columns:1fr 1fr}.voice-orb{width:82px;height:82px}}
  `;
  document.head.appendChild(style);

  const getContext = () => { try { return JSON.parse(sessionStorage.getItem('gjrInterviewContext') || '{}'); } catch { return {}; } };
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stopSpeech = () => { try { window.speechSynthesis?.cancel(); } catch {} speaking = false; };
  const voices = () => window.speechSynthesis?.getVoices?.() || [];
  const chooseVoice = () => voices().find(v => /^en-IN/i.test(v.lang)) || voices().find(v => /^en-GB/i.test(v.lang)) || voices().find(v => /^en-US/i.test(v.lang)) || voices()[0];
  const setStatus = (text, state='') => { const el=document.querySelector('.voice-status'); if(el) el.textContent=text; const orb=document.querySelector('.voice-orb'); if(orb) orb.className=`voice-orb ${state}`; const wave=document.querySelector('.voice-wave'); if(wave) wave.classList.toggle('live',state==='listening'||state==='speaking'); };
  const setTranscript = text => { const el=document.querySelector('.voice-transcript'); if(el) el.textContent=text; };
  const speak = (text, done) => {
    if (!('speechSynthesis' in window)) { done?.(); return; }
    stopSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang='en-IN'; u.rate=.95; u.pitch=1;
    const v=chooseVoice(); if(v) u.voice=v;
    u.onstart=()=>{speaking=true;setStatus('AI interviewer is speaking…','speaking');};
    u.onend=()=>{speaking=false;done?.();};
    u.onerror=()=>{speaking=false;done?.();};
    window.speechSynthesis.speak(u);
  };
  const render = () => {
    const interview=document.querySelector('.interview');
    if(!interview || mounted===interview) return;
    mounted=interview;
    const q=interview.querySelector('.question-card h2');
    question=q?.textContent?.trim() || 'Tell me about yourself and why you want this role?';
    const old=interview.querySelector('textarea'); if(old) old.style.display='none';
    const actions=interview.querySelector('.interview-actions'); if(actions) actions.style.display='none';
    const panel=document.createElement('section'); panel.className='voice-stage';
    panel.innerHTML=`<div class="voice-head"><div><div class="voice-kicker">Live AI interview</div><div class="voice-title">Talk. Listen. Respond.</div></div><div class="voice-counter">Question <span data-v-count>1</span> / ${maxTurns}</div></div><div class="voice-orb-wrap"><div class="voice-orb"><span>🎙️</span></div></div><div class="voice-status">Ready when you are.</div><div class="voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="voice-question"><small>AI INTERVIEWER</small><h2 data-v-question>${esc(question)}</h2></div><div class="voice-transcript" data-v-transcript></div><div class="voice-actions"><button class="voice-action primary" data-v-start>▶ Start conversation</button><button class="voice-action" data-v-repeat disabled>↻ Repeat question</button><button class="voice-action" data-v-mic disabled>🎤 Speak now</button><button class="voice-action" data-v-stop disabled>■ End interview</button></div><div class="voice-foot"><span>Speak naturally. The AI decides what to ask next.</span><button class="voice-stop" data-v-stop2 disabled>End</button></div><div class="voice-text-fallback">Voice works best in Chrome/Edge. <span data-v-hint></span></div>`;
    interview.appendChild(panel);
    panel.querySelector('[data-v-start]').onclick=startConversation;
    panel.querySelector('[data-v-repeat]').onclick=()=>speakQuestion();
    panel.querySelector('[data-v-mic]').onclick=startListening;
    panel.querySelector('[data-v-stop]').onclick=endInterview;
    panel.querySelector('[data-v-stop2]').onclick=endInterview;
    if(!SR){ panel.querySelector('[data-v-start]').disabled=true; panel.querySelector('[data-v-hint]').textContent='This browser does not expose microphone speech recognition. Try Chrome or Edge.'; }
    else panel.querySelector('[data-v-hint]').textContent='Your microphone is used for speech recognition.';
    updateButtons();
  };
  const updateButtons=()=>{const s=document.querySelector('[data-v-start]'),r=document.querySelector('[data-v-repeat]'),m=document.querySelector('[data-v-mic]'),e=document.querySelector('[data-v-stop]'),e2=document.querySelector('[data-v-stop2]');if(!s)return;s.disabled=!SR||running||processing;r.disabled=!question||speaking||listening||processing;m.disabled=!SR||!running||speaking||listening||processing;e.disabled=!running||processing;e2.disabled=e.disabled;};
  const speakQuestion=()=>{ if(!question)return; setStatus('AI interviewer is speaking…','speaking'); speak(question,()=>{ if(running) setTimeout(startListening,250); }); updateButtons(); };
  const startConversation=()=>{ if(!SR)return; running=true;turn=1;answers=[];transcript='';setTranscript('');updateButtons();speakQuestion(); };
  const startListening=()=>{
    if(!SR||!running||speaking||listening||processing)return;
    transcript='';setTranscript('');
    try { recognition=new SR(); recognition.lang='en-IN'; recognition.continuous=false; recognition.interimResults=true; recognition.maxAlternatives=1; }
    catch { setStatus('Could not start the microphone.'); return; }
    recognition.onstart=()=>{listening=true;setStatus('Listening — speak naturally.','listening');updateButtons();};
    recognition.onresult=e=>{let finalText='',interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)finalText+=t+' ';else interim+=t;}transcript=(transcript+' '+finalText).trim();setTranscript((transcript+' '+interim).trim());};
    recognition.onerror=e=>{listening=false;setStatus(e.error==='not-allowed'?'Microphone permission is blocked. Allow microphone access and try again.':'I couldn’t hear that clearly. Tap Speak now and try again.');updateButtons();};
    recognition.onend=()=>{listening=false;updateButtons();const answer=transcript.trim();if(answer)processAnswer(answer);else if(running)setStatus('I didn’t catch an answer. Tap Speak now to continue.');};
    try{recognition.start();}catch{listening=false;updateButtons();}
  };
  const processAnswer=async answer=>{
    if(processing)return; processing=true; setStatus('AI is evaluating your answer…','thinking'); updateButtons();
    const context=getContext(); const history=[...answers,{question,answer}];
    try{
      const r=await fetch('/api/interview-turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jd:context.jd||'',career:context.career||'job',question,answer,history,turn,maxTurns})});
      const data=await r.json();
      answers=history;
      if(data.done){
        running=false;processing=false;question='';setStatus('Interview complete.','');setTranscript(data.evaluation?.improvement||'Your final feedback is ready.');const count=document.querySelector('[data-v-count]');if(count)count.textContent=String(turn);const q=document.querySelector('[data-v-question]');if(q)q.textContent='That’s a wrap — great work.';const stage=document.querySelector('.voice-stage');if(stage){const complete=document.createElement('div');complete.className='voice-complete';complete.innerHTML=`<div class="voice-score">${Number(data.finalFeedback?.score||data.evaluation?.score||0)}/100</div><b>Your interview is complete.</b><p>${esc(data.finalFeedback?.nextAction||'Your detailed feedback is ready.')}</p>`;stage.appendChild(complete);}speak('Thank you. Your interview is complete. Your detailed feedback is ready.',()=>{});window.dispatchEvent(new CustomEvent('gjr:interview-finished',{detail:data.finalFeedback||{score:data.evaluation?.score||0,strengths:data.evaluation?.strengths||[],improvements:[data.evaluation?.improvement||'Keep using specific examples and measurable outcomes.'],nextAction:'Review the feedback and repeat the interview.'}}));updateButtons();return;}
      turn+=1;question=String(data.nextQuestion||'Tell me more about that.');processing=false;const q=document.querySelector('[data-v-question]');if(q)q.textContent=question;const count=document.querySelector('[data-v-count]');if(count)count.textContent=String(turn);setTranscript(data.evaluation?.improvement?`Quick feedback: ${data.evaluation.improvement}`:'');setStatus('Next question coming up…','thinking');setTimeout(()=>speakQuestion(),500);
    }catch(error){processing=false;setStatus('Connection issue. Tap Speak now to retry this answer.');updateButtons();}
  };
  const endInterview=()=>{running=false;processing=false;try{recognition?.abort()}catch{}stopSpeech();listening=false;setStatus('Interview paused.');updateButtons();};
  const observer=new MutationObserver(()=>{if(!document.querySelector('.voice-stage')){mounted=null;setTimeout(render,0);}});
  observer.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();