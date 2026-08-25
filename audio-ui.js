(()=>{
const enhance=()=>{
  const stage=document.querySelector('.voice-stage');
  if(!stage||stage.dataset.audioV2)return;
  stage.dataset.audioV2='1';
  const status=stage.querySelector('#voiceStatus')?.textContent||'Ready to start';
  const question=stage.querySelector('#voiceQuestion')?.textContent||'Tell me about yourself and why you want this role?';
  const mode=sessionStorage.getItem('gjr_cv_mode')||localStorage.getItem('gjr_cv_mode')||'specific';
  stage.className='live-card';
  stage.innerHTML=`<div class="live-top"><span class="live-pill"><i class="live-dot"></i> LIVE AI INTERVIEW</span><span>${mode==='general'?'CV INTERVIEW':'CV + JD INTERVIEW'}</span></div><div class="voice-orb" id="voiceOrb"><span class="orb-ring"></span><span style="font-size:38px">🎙️</span></div><h2 id="voiceQuestion">${escapeHtml(question)}</h2><p class="voice-status" id="voiceStatus">${escapeHtml(status)}</p><div class="transcript" id="voiceTranscript"><span>You</span><p>When you speak, your answer will appear here.</p></div><div class="voice-actions"><button class="primary voice-start" id="voiceStart">▶ Start conversation</button><button class="mic-button" id="voiceStop" disabled title="Stop">■</button></div><div class="voice-tip">🎧 AI speaks → you speak → AI listens → AI responds → adaptive follow-up. Use headphones and allow microphone access.</div>`;
  const oldStart=document.querySelector('#voiceStart');
  const oldStop=document.querySelector('#voiceStop');
  oldStart?.addEventListener('click',()=>setTimeout(sync,30));
  oldStop?.addEventListener('click',()=>setTimeout(sync,30));
};
const escapeHtml=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const sync=()=>{
 const o=document.querySelector('#voiceOrb'),s=document.querySelector('#voiceStatus');
 if(!o||!s)return;
 const t=s.textContent||'';
 o.className='voice-orb '+(t.toLowerCase().includes('listening')?'listening':t.toLowerCase().includes('speaking')?'speaking':t.toLowerCase().includes('thinking')?'thinking':'');
};
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
setTimeout(enhance,120);
})();
