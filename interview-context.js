(()=>{
  if(window.__gjrInterviewContext)return;
  window.__gjrInterviewContext=true;
  const keyMode='gjr_cv_mode', keyData='gjr_cv_data', keyMime='gjr_cv_mime', keyText='gjr_cv_text';
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/api/analyze-upload')||url.includes('/api/interview-turn')){
      try{
        const body=JSON.parse(init.body||'{}');
        body.mode=localStorage.getItem(keyMode)||'specific';
        if(url.includes('/api/analyze-upload')){
          if(body.data){sessionStorage.setItem(keyData,body.data);sessionStorage.setItem(keyMime,body.mime||'application/pdf');}
          const cvText=document.querySelector('#cvText')?.value||'';
          if(cvText)sessionStorage.setItem(keyText,cvText);
        }else{
          body.cvData=sessionStorage.getItem(keyData)||'';
          body.cvMime=sessionStorage.getItem(keyMime)||'';
          body.cv=sessionStorage.getItem(keyText)||'';
        }
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return originalFetch(input,init);
  };
  const remember=()=>{const t=document.querySelector('#cvText');if(t&&!t.dataset.gjrContext){t.dataset.gjrContext='1';const save=()=>sessionStorage.setItem(keyText,t.value||'');t.addEventListener('input',save);if(t.value)save();}};
  new MutationObserver(remember).observe(document.documentElement,{childList:true,subtree:true});
  remember();
})();
