(()=>{
  const WORKER='https://getjobready-ai-proxy.mnijhara.workers.dev';
  let mounted=false;
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const mode=()=>sessionStorage.getItem('gjr_cv_mode')||'specific';
  const cvText=()=>sessionStorage.getItem('gjr_cv_text')||'';
  const jdText=()=>sessionStorage.getItem('gjr_jd_text')||'';
  const cvData=()=>sessionStorage.getItem('gjr_cv_data')||'';
  const cvMime=()=>sessionStorage.getItem('gjr_cv_mime')||'';
  const native=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if((url==='/api/interview-turn'||url==='/api/interview-feedback')&&init.method==='POST'){
      try{
        if(sessionStorage.getItem('gjr_cv_ready')==='1'){
          const improved=sessionStorage.getItem('gjr_cv_improved')||'';
          if(improved.trim()){
            const body=typeof init.body==='string'?JSON.parse(init.body):(init.body||{});
            body.cv=improved;
            body.cvData='';
            body.cvMime='';
            init={...init,body:JSON.stringify(body)};
          }
        }
      }catch{}
    }
    if(url==='/api/improve-cv' && init.method==='POST'){
      try{
        const body=typeof init.body==='string'?JSON.parse(init.body):(init.body||{});
        const prompt=`You are an expert campus recruiter and CV editor. Improve this student's CV without inventing facts. Mode: ${body.mode==='general'?'general CV review':'CV targeted to a specific job'}. ${body.mode==='specific'?'Target JD:\n'+String(body.jd||'').slice(0,30000):'Do not assume a target job.'}\nReturn ONLY valid JSON with exactly these keys: {"summary":"...","changes":["..."],"keywords":["..."],"improvedCV":"..."}. Preserve all factual information, employers, dates, education, projects and metrics. Improve structure, clarity, impact and ATS-friendly wording. Do not add unsupported skills, achievements or numbers. CV:\n${String(body.cv||'').slice(0,40000)}`;
        const parts=[{text:prompt}];
        if(body.cvData&&body.cvMime)parts.push({inlineData:{mimeType:body.cvMime,data:body.cvData}});
        const r=await native(`${WORKER}/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,contents:[{parts}],model:'gemini-3.7-flash',generationConfig:{responseMimeType:'application/json',maxOutputTokens:7000},json:true})});
        const raw=await r.text();if(!r.ok)throw new Error('AI service '+r.status);
        const data=JSON.parse(raw);const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||data?.text||'';const clean=String(text).trim().replace(/^```json\s*/i,'').replace(/\s*```$/,'');
        return new Response(JSON.stringify(JSON.parse(clean)),{status:200,headers:{'Content-Type':'application/json'}});
      }catch(e){return new Response(JSON.stringify({error:'CV improvement service unavailable.'}),{status:503,headers:{'Content-Type':'application/json'}})}
    }
    return native(input,init);
  };
  const css=`.cv-studio{margin:18px 0;padding:22px;border:1px solid #e4e0ff;border-radius:24px;background:linear-gradient(145deg,#faf9ff,#fff);box-shadow:0 12px 35px #191f3b0d}.cv-studio-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.cv-studio-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:#6855e8;text-transform:uppercase}.cv-studio h3{margin:5px 0 4px;font-size:22px}.cv-studio p{color:#6f7787;margin:0;line-height:1.55}.cv-studio-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.cv-studio-box{background:#fff;border:1px solid #eceaf5;border-radius:17px;padding:14px}.cv-studio-box h4{margin:0 0 10px}.cv-studio-box ul{margin:0;padding-left:19px;color:#687183}.cv-studio textarea{width:100%;min-height:260px;border:1px solid #e4e5ec;border-radius:14px;padding:13px;font:500 13px/1.6 Manrope,system-ui,sans-serif;resize:vertical;box-sizing:border-box}.cv-studio-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}.cv-studio button{border:0;border-radius:13px;padding:12px 16px;font-weight:800;cursor:pointer}.cv-studio .cv-primary{background:#171e31;color:#fff}.cv-studio .cv-secondary{background:#f0edff;color:#5d4ac7}.cv-studio-status{margin-top:10px;font-size:12px;color:#6b7382}.cv-continue{margin-top:15px;width:100%;padding:15px;border:0;border-radius:15px;background:linear-gradient(90deg,#171e31,#4f35a9);color:#fff;font-weight:900;font-size:15px;cursor:pointer}.cv-locked{opacity:.55;filter:saturate(.7)}@media(max-width:700px){.cv-studio-grid{grid-template-columns:1fr}.cv-studio{padding:17px;border-radius:20px}.cv-studio textarea{min-height:230px}}`;
  function inject(){if(document.getElementById('cv-studio-css'))return;const s=document.createElement('style');s.id='cv-studio-css';s.textContent=css;document.head.appendChild(s)}
  function mount(){if(mounted)return;const workspace=document.querySelector('.workspace');const title=[...document.querySelectorAll('.workspace h1')].find(x=>/Preparation Report/i.test(x.textContent||''));if(!workspace||!title)return;const start=[...workspace.querySelectorAll('button')].find(b=>/live audio interview/i.test(b.textContent||''));if(!start)return;mounted=true;inject();start.style.display='none';const studio=document.createElement('section');studio.className='cv-studio';const text=cvText();studio.innerHTML=`<div class="cv-studio-head"><div><div class="cv-studio-kicker">BEFORE YOUR INTERVIEW</div><h3>Make your CV stronger first.</h3><p>Review the AI's recommendations, edit your CV and save your final version. Your interview will use the improved version.</p></div><span>✦</span></div><div class="cv-studio-grid"><div class="cv-studio-box"><h4>What to improve</h4><ul data-cv-changes><li>Run an AI CV review to identify weak wording, missing evidence and role-fit gaps.</li></ul></div><div class="cv-studio-box"><h4>Your editable CV</h4><textarea data-cv-editor placeholder="Your CV text will appear here. You can edit it before your interview.">${esc(text)}</textarea></div></div><div class="cv-studio-actions"><button class="cv-primary" data-cv-analyze>✦ Analyse & improve my CV</button><button class="cv-secondary" data-cv-apply disabled>Use AI improved version</button></div><div class="cv-studio-status" data-cv-status>Nothing is sent until you choose Analyse.</div><button class="cv-continue cv-locked" data-cv-continue disabled>Continue to live audio interview →</button>`;start.parentElement?.insertAdjacentElement('beforebegin',studio);const editor=studio.querySelector('[data-cv-editor]'),changes=studio.querySelector('[data-cv-changes]'),status=studio.querySelector('[data-cv-status]'),analyze=studio.querySelector('[data-cv-analyze]'),apply=studio.querySelector('[data-cv-apply]'),cont=studio.querySelector('[data-cv-continue]');analyze.onclick=async()=>{status.textContent='AI is reviewing your CV…';analyze.disabled=true;try{const r=await fetch('/api/improve-cv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:editor.value,cvData:cvData(),cvMime:cvMime(),jd:jdText(),mode:mode()})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to improve CV');editor.value=d.improvedCV||editor.value;if(Array.isArray(d.changes))changes.innerHTML=d.changes.map(x=>`<li>${esc(x)}</li>`).join('');apply.disabled=false;status.textContent='AI improved draft loaded. Review and edit it before saving.';}catch(e){status.textContent=e.message||'CV improvement failed. Try again.';}finally{analyze.disabled=false}};apply.onclick=()=>{sessionStorage.setItem('gjr_cv_improved',editor.value);sessionStorage.setItem('gjr_cv_text',editor.value);sessionStorage.setItem('gjr_cv_ready','1');sessionStorage.removeItem('gjr_cv_data');sessionStorage.removeItem('gjr_cv_mime');apply.disabled=true;cont.disabled=false;cont.classList.remove('cv-locked');status.textContent='Saved. You are in control of the final CV. You can still edit it above.'};editor.addEventListener('input',()=>{sessionStorage.removeItem('gjr_cv_ready');cont.disabled=true;cont.classList.add('cv-locked');apply.disabled=false;status.textContent='Unsaved edits — save this version before interviewing.'});cont.onclick=()=>{sessionStorage.setItem('gjr_cv_improved',editor.value);sessionStorage.setItem('gjr_cv_text',editor.value);sessionStorage.setItem('gjr_cv_ready','1');sessionStorage.removeItem('gjr_cv_data');sessionStorage.removeItem('gjr_cv_mime');start.style.display='';start.click()}}
  new MutationObserver(()=>setTimeout(mount,20)).observe(document.body,{childList:true,subtree:true});setTimeout(mount,500);
})();
