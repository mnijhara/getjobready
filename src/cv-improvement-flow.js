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
  function parseModelResponse(raw){
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      if(raw.improvedCV||raw.changes||raw.summary)return raw;
      const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||raw?.text||raw?.output||raw?.response||'';
      if(text)return parseModelResponse(text);
    }
    const clean=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');
    try{return JSON.parse(clean)}catch{}
    const start=clean.indexOf('{'),end=clean.lastIndexOf('}');
    if(start>=0&&end>start){try{return JSON.parse(clean.slice(start,end+1))}catch{}}
    throw new Error('The AI returned an unreadable response.');
  }
  async function extractUploadedCV(){
    const existing=cvText().trim();if(existing)return existing;
    const data=cvData(),mime=cvMime();if(!data)return '';
    if(mime==='text/plain'){try{return atob(data)}catch{return ''}}
    if(mime==='application/pdf'){
      try{
        const pdfjs=await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.mjs',import.meta.url).toString();
        const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
        const pdf=await pdfjs.getDocument({data:bytes}).promise;let out='';
        for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();out+=content.items.map(x=>x.str).join(' ')+'\n'}
        return out.trim();
      }catch(e){console.warn('CV extraction failed',e);return ''}
    }
    return '';
  }
  async function workerImprove(body){
    const prompt=`You are an expert campus recruiter and CV editor. Improve this student's CV without inventing facts. Mode: ${body.mode==='general'?'general CV review':'CV targeted to a specific job'}. ${body.mode==='specific'?'Target JD:\n'+String(body.jd||'').slice(0,30000):'Do not assume a target job.'}\nReturn ONLY valid JSON with exactly these keys: {"summary":"short summary","changes":["specific changes, max 6"],"keywords":["relevant keywords, max 10"],"improvedCV":"complete improved CV"}. Preserve every factual detail unless correcting obvious formatting. Never add unsupported employers, dates, degrees, skills, achievements, numbers or responsibilities. Improve structure, clarity, action verbs, evidence, readability and ATS-friendly wording. Keep the candidate's real voice. The improvedCV must be complete, not a partial excerpt.\n\nCV TEXT:\n${String(body.cv||'').slice(0,45000)}`;
    const parts=[{text:prompt}];
    if(body.cvData&&body.cvMime)parts.push({inlineData:{mimeType:body.cvMime,data:body.cvData}});
    const r=await native(`${WORKER}/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,contents:[{parts}],model:'gemini-3.7-flash',generationConfig:{responseMimeType:'application/json',maxOutputTokens:7000},json:true})});
    const raw=await r.text();if(!r.ok)throw new Error(`AI service ${r.status}`);return parseModelResponse(raw);
  }
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(url==='/api/improve-cv'&&init.method==='POST'){
      try{const body=typeof init.body==='string'?JSON.parse(init.body):(init.body||{});const result=await workerImprove(body);return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}})}
      catch(e){return new Response(JSON.stringify({error:'CV improvement service unavailable. Please retry.'}),{status:503,headers:{'Content-Type':'application/json'}})}
    }
    if((url==='/api/interview-turn'||url==='/api/interview-feedback')&&init.method==='POST'){
      try{if(sessionStorage.getItem('gjr_cv_ready')==='1'){const improved=sessionStorage.getItem('gjr_cv_improved')||'';if(improved.trim()){const body=typeof init.body==='string'?JSON.parse(init.body):(init.body||{});body.cv=improved;body.cvData='';body.cvMime='';init={...init,body:JSON.stringify(body)}}}}catch{}
    }
    return native(input,init);
  };
  const css=`.cv-studio{margin:20px 0;padding:22px;border:1px solid #e5e1ff;border-radius:26px;background:linear-gradient(145deg,#fbfaff,#fff);box-shadow:0 18px 50px #171e3110}.cv-studio-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.cv-studio-kicker{font-size:11px;font-weight:900;letter-spacing:.13em;color:#6b57e8;text-transform:uppercase}.cv-studio h3{margin:6px 0 5px;font-size:24px}.cv-studio p{color:#697386;margin:0;line-height:1.55}.cv-studio-badge{white-space:nowrap;border-radius:999px;padding:7px 10px;background:#f0edff;color:#5f4dc7;font-size:11px;font-weight:900}.cv-studio-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:14px;margin-top:18px}.cv-studio-box{background:#fff;border:1px solid #eceaf5;border-radius:18px;padding:16px}.cv-studio-box h4{margin:0 0 10px;font-size:15px}.cv-studio-box ul{margin:0;padding-left:19px;color:#687183;line-height:1.55}.cv-studio-box li+li{margin-top:7px}.cv-studio textarea{width:100%;min-height:330px;border:1px solid #dedee8;border-radius:16px;padding:15px;font:500 13px/1.65 Manrope,system-ui,sans-serif;resize:vertical;box-sizing:border-box;color:#171e31;background:#fff}.cv-studio textarea:focus{outline:3px solid #6b57e81c;border-color:#6b57e8}.cv-studio-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.cv-studio button{border:0;border-radius:14px;padding:13px 17px;font-weight:850;cursor:pointer}.cv-studio button:disabled{opacity:.45;cursor:not-allowed}.cv-primary{background:#171e31;color:#fff}.cv-secondary{background:#eeeaff;color:#5d4ac7}.cv-save{background:#6b57e8;color:#fff}.cv-studio-status{margin-top:10px;font-size:12px;color:#687183;line-height:1.5}.cv-studio-status.ok{color:#16845b}.cv-studio-status.err{color:#a13c3c}.cv-continue{margin-top:15px;width:100%;padding:15px;border:0;border-radius:15px;background:linear-gradient(90deg,#171e31,#4f35a9);color:#fff;font-weight:900;font-size:15px;cursor:pointer}.cv-continue:disabled{opacity:.42;cursor:not-allowed}.cv-studio-summary{display:none;margin-top:14px;padding:12px 14px;border-radius:14px;background:#f7f5ff;color:#55506f;font-size:12px;line-height:1.5}.cv-studio-summary.show{display:block}@media(max-width:700px){.cv-studio-grid{grid-template-columns:1fr}.cv-studio{padding:17px;border-radius:21px}.cv-studio textarea{min-height:300px}.cv-studio-head{gap:10px}.cv-studio h3{font-size:21px}}`;
  function inject(){if(document.getElementById('cv-studio-css'))return;const s=document.createElement('style');s.id='cv-studio-css';s.textContent=css;document.head.appendChild(s)}
  function mount(){
    if(mounted)return;
    const workspace=document.querySelector('.workspace'),title=[...document.querySelectorAll('.workspace h1')].find(x=>/Preparation Report/i.test(x.textContent||''));if(!workspace||!title)return;
    const start=[...workspace.querySelectorAll('button')].find(b=>/live audio interview/i.test(b.textContent||''));if(!start)return;
    mounted=true;inject();start.style.display='none';
    const studio=document.createElement('section');studio.className='cv-studio';
    studio.innerHTML=`<div class="cv-studio-head"><div><div class="cv-studio-kicker">BEFORE YOUR INTERVIEW</div><h3>Make your CV stronger first.</h3><p>AI finds weak wording and gaps, then gives you a complete editable draft. You stay in control of the final version.</p></div><span class="cv-studio-badge">CV STUDIO</span></div><div class="cv-studio-grid"><div class="cv-studio-box"><h4>What to improve</h4><ul data-cv-changes><li>Preparing your CV review…</li></ul><div class="cv-studio-summary" data-cv-summary></div></div><div class="cv-studio-box"><h4>Your editable CV</h4><textarea data-cv-editor placeholder="Your extracted CV will appear here…"></textarea></div></div><div class="cv-studio-actions"><button class="cv-primary" data-cv-analyze>✦ Review with AI</button><button class="cv-secondary" data-cv-apply disabled>Use AI draft</button><button class="cv-save" data-cv-save disabled>Save final CV</button></div><div class="cv-studio-status" data-cv-status>Loading your uploaded CV…</div><button class="cv-continue" data-cv-continue disabled>Continue to live audio interview →</button>`;
    start.parentElement?.insertAdjacentElement('beforebegin',studio);
    const editor=studio.querySelector('[data-cv-editor]'),changes=studio.querySelector('[data-cv-changes]'),summary=studio.querySelector('[data-cv-summary]'),status=studio.querySelector('[data-cv-status]'),analyze=studio.querySelector('[data-cv-analyze]'),apply=studio.querySelector('[data-cv-apply]'),save=studio.querySelector('[data-cv-save]'),cont=studio.querySelector('[data-cv-continue]');let aiDraft='';
    const setStatus=(text,kind='')=>{status.textContent=text;status.className='cv-studio-status '+kind};
    const markDirty=()=>{sessionStorage.removeItem('gjr_cv_ready');sessionStorage.removeItem('gjr_cv_improved');cont.disabled=true;save.disabled=!editor.value.trim();setStatus('Unsaved edits. Save your final CV before starting the interview.')};
    editor.addEventListener('input',markDirty);
    save.onclick=()=>{const text=editor.value.trim();if(!text)return;sessionStorage.setItem('gjr_cv_text',text);sessionStorage.setItem('gjr_cv_improved',text);sessionStorage.setItem('gjr_cv_ready','1');sessionStorage.removeItem('gjr_cv_data');sessionStorage.removeItem('gjr_cv_mime');cont.disabled=false;setStatus('Final CV saved. Your interview will use this exact version.','ok');save.disabled=true};
    apply.onclick=()=>{if(!aiDraft)return;editor.value=aiDraft;save.disabled=false;cont.disabled=true;setStatus('AI draft loaded. Review it, make any edits, then save your final CV.','ok')};
    analyze.onclick=async()=>{const text=editor.value.trim();if(!text&&!cvData()){setStatus('No CV text was found. Go back and upload the CV again.','err');return}analyze.disabled=true;apply.disabled=true;setStatus('AI is reviewing your CV. This can take a few seconds…');try{const d=await fetch('/api/improve-cv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:text,cvData:text?'':cvData(),cvMime:text?'':cvMime(),jd:jdText(),mode:mode()})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'CV improvement failed.');return d});aiDraft=String(d.improvedCV||text||'').trim();if(!aiDraft)throw new Error('AI did not return an improved CV.');editor.value=aiDraft;changes.innerHTML=(Array.isArray(d.changes)&&d.changes.length?d.changes:['Improve clarity, structure and evidence while preserving your facts.']).map(x=>`<li>${esc(x)}</li>`).join('');if(d.summary){summary.textContent=d.summary;summary.classList.add('show')}apply.disabled=false;save.disabled=false;cont.disabled=true;setStatus('AI draft ready. Review every change, then save your final CV.','ok')}catch(e){console.error('CV improvement failed',e);save.disabled=!editor.value.trim();setStatus('AI review could not complete right now. Your CV is still editable — review it manually and save your final version, or retry AI review.','err')}finally{analyze.disabled=false}};
    cont.onclick=()=>{const text=editor.value.trim();if(!text)return;sessionStorage.setItem('gjr_cv_text',text);sessionStorage.setItem('gjr_cv_improved',text);sessionStorage.setItem('gjr_cv_ready','1');sessionStorage.removeItem('gjr_cv_data');sessionStorage.removeItem('gjr_cv_mime');start.style.display='';start.click()};
    (async()=>{const extracted=await extractUploadedCV();if(extracted){editor.value=extracted;sessionStorage.setItem('gjr_cv_text',extracted);save.disabled=false;setStatus('Your uploaded CV is ready to edit. Starting the AI review…','ok');setTimeout(()=>analyze.click(),250)}else if(cvData()){setStatus('Your PDF is uploaded. Starting the AI review…');setTimeout(()=>analyze.click(),250)}else{editor.value=cvText();save.disabled=!editor.value.trim();setStatus(editor.value?'Your CV is ready to edit.':'Upload a CV to begin.',editor.value?'ok':'err')}})();
  }
  new MutationObserver(()=>setTimeout(mount,30)).observe(document.body,{childList:true,subtree:true});setTimeout(mount,500);
})();