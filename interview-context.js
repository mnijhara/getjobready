(()=>{
  if(window.__gjrInterviewContext)return;
  window.__gjrInterviewContext=true;
  const keyMode='gjr_cv_mode', keyData='gjr_cv_data', keyMime='gjr_cv_mime', keyText='gjr_cv_text', keyJd='gjr_jd_text', keyInterview='gjr_interview_mode';
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if((url.includes('/api/analyze-upload')||url.includes('/api/analyze')||url.includes('/api/interview-turn'))&&init?.method==='POST'){
      try{
        const body=JSON.parse(init.body||'{}');
        const selected=localStorage.getItem(keyMode)||'specific';
        body.mode=selected;
        const cvText=document.querySelector('#cvText')?.value;
        const jdText=document.querySelector('#jdText')?.value;
        if(cvText!==undefined)sessionStorage.setItem(keyText,cvText||'');
        if(jdText!==undefined&&!jdText.startsWith('GENERAL CV REVIEW'))sessionStorage.setItem(keyJd,jdText||'');
        if(url.includes('/api/analyze-upload')){
          if(body.data){sessionStorage.setItem(keyData,body.data);sessionStorage.setItem(keyMime,body.mime||'application/pdf');}
          body.jd=selected==='general'?'':(body.jd||sessionStorage.getItem(keyJd)||'');
          if(!body.data){
            const cv=sessionStorage.getItem(keyText)||'';
            if(cv){body.cv=cv;return originalFetch('/api/analyze',{...init,body:JSON.stringify(body)});}
          }
        }else if(url.includes('/api/analyze')){
          body.cv=body.cv||sessionStorage.getItem(keyText)||'';
          body.jd=selected==='general'?'':(body.jd||sessionStorage.getItem(keyJd)||'');
        }else{
          body.mode=localStorage.getItem(keyInterview)||selected;
          body.cvData=sessionStorage.getItem(keyData)||'';
          body.cvMime=sessionStorage.getItem(keyMime)||'';
          body.cv=sessionStorage.getItem(keyText)||body.cv||'';
          body.jd=body.jd||sessionStorage.getItem(keyJd)||'';
        }
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return originalFetch(input,init);
  };
  const remember=()=>{
    const t=document.querySelector('#cvText');
    if(t&&!t.dataset.gjrContext){t.dataset.gjrContext='1';const save=()=>sessionStorage.setItem(keyText,t.value||'');t.addEventListener('input',save);if(t.value)save();}
    const j=document.querySelector('#jdText');
    if(j&&!j.dataset.gjrContext){j.dataset.gjrContext='1';const save=()=>{if(!j.value.startsWith('GENERAL CV REVIEW'))sessionStorage.setItem(keyJd,j.value||'');};j.addEventListener('input',save);if(j.value&&!j.value.startsWith('GENERAL CV REVIEW'))save();}
  };
  function interviewChooser(){
    if(document.querySelector('.gjr-interview-modal'))return;
    const m=document.createElement('div');m.className='gjr-interview-modal';m.style.cssText='position:fixed;inset:0;z-index:99999;background:#11182799;display:grid;place-items:center;padding:20px';
    m.innerHTML='<div style="width:min(430px,100%);background:#fff;border-radius:26px;padding:24px;box-shadow:0 25px 80px #0003"><button data-close style="float:right;border:0;border-radius:50%;width:32px;height:32px;font-size:20px">×</button><span class="eyebrow">AI AUDIO INTERVIEW</span><h2>Choose your interview</h2><p style="color:#697386;line-height:1.5;font-size:13px">Your questions will be generated from the preparation context you choose.</p><button data-interview="general" style="width:100%;text-align:left;border:1px solid #e1e4ed;background:#fafbfe;border-radius:17px;padding:15px;margin-top:10px"><b>🎙️ General CV interview</b><br><small>Questions based on your CV: projects, experience, achievements and behavioural readiness.</small></button><button data-interview="specific" style="width:100%;text-align:left;border:1px solid #171e31;background:#171e31;color:#fff;border-radius:17px;padding:15px;margin-top:10px"><b>🎯 Role-specific CV + JD interview</b><br><small>Questions based on your CV + one specific JD, with role-specific follow-ups.</small></button></div>';
    document.body.appendChild(m);
    m.addEventListener('click',e=>{
      if(e.target===m||e.target.closest('[data-close]'))return m.remove();
      const b=e.target.closest('[data-interview]');if(!b)return;
      localStorage.setItem(keyInterview,b.dataset.interview);localStorage.setItem(keyMode,b.dataset.interview);m.remove();
      const r=document.querySelector('[data-module="resume"]');if(r)r.click();
    });
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-module="interview"],#interviewBtn');
    if(target){e.preventDefault();e.stopImmediatePropagation();interviewChooser();return;}
    const analyze=e.target.closest('#analyzeBtn');
    if(analyze&&(localStorage.getItem(keyMode)||'specific')==='general'){
      const jd=document.querySelector('#jdText');
      if(jd&&!jd.value){jd.value='GENERAL CV REVIEW — no target job description';jd.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  },true);
  new MutationObserver(remember).observe(document.documentElement,{childList:true,subtree:true});
  remember();
})();
