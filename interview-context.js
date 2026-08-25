(()=>{
  if(window.__gjrInterviewContext)return;
  window.__gjrInterviewContext=true;
  const keyMode='gjr_cv_mode', keyData='gjr_cv_data', keyMime='gjr_cv_mime', keyText='gjr_cv_text', keyJd='gjr_jd_text';
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if((url.includes('/api/analyze-upload')||url.includes('/api/analyze')||url.includes('/api/interview-turn'))&&init?.method==='POST'){
      try{
        const body=JSON.parse(init.body||'{}');
        body.mode=localStorage.getItem(keyMode)||'specific';
        const cvText=document.querySelector('#cvText')?.value;
        const jdText=document.querySelector('#jdText')?.value;
        if(cvText!==undefined)sessionStorage.setItem(keyText,cvText||'');
        if(jdText!==undefined&&!jdText.startsWith('GENERAL CV REVIEW'))sessionStorage.setItem(keyJd,jdText||'');
        if(url.includes('/api/analyze-upload')){
          if(body.data){sessionStorage.setItem(keyData,body.data);sessionStorage.setItem(keyMime,body.mime||'application/pdf');}
          body.jd=body.jd||sessionStorage.getItem(keyJd)||'';
          if(!body.data){
            const cv=sessionStorage.getItem(keyText)||'';
            if(cv){body.cv=cv;return originalFetch('/api/analyze',{...init,body:JSON.stringify(body)});}
          }
        }else if(url.includes('/api/analyze')){
          body.cv=body.cv||sessionStorage.getItem(keyText)||'';
          body.jd=body.jd||sessionStorage.getItem(keyJd)||'';
        }else{
          body.cvData=sessionStorage.getItem(keyData)||'';
          body.cvMime=sessionStorage.getItem(keyMime)||'';
          body.cv=sessionStorage.getItem(keyText)||'';
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
  new MutationObserver(remember).observe(document.documentElement,{childList:true,subtree:true});
  remember();
})();
