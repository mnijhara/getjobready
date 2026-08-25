(()=>{
  const CV='gjr_cv_context', JD='gjr_jd_context', MODE='gjr_cv_mode', FILE='gjr_cv_file_context';
  const save=()=>{
    const cv=document.querySelector('#cvText')?.value;
    const jd=document.querySelector('#jdText')?.value;
    if(cv!==undefined) localStorage.setItem(CV,cv);
    if(jd!==undefined && !jd.startsWith('GENERAL CV REVIEW')) localStorage.setItem(JD,jd);
  };
  document.addEventListener('input',e=>{if(e.target?.id==='cvText'||e.target?.id==='jdText')save();},true);
  document.addEventListener('change',e=>{if(e.target?.id==='cvFile'||e.target?.id==='jdFile')save();},true);
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(init?.method==='POST' && typeof init.body==='string' && (url.endsWith('/api/analyze-upload')||url.endsWith('/api/analyze')||url.endsWith('/api/interview-turn'))){
      try{
        const body=JSON.parse(init.body);
        const mode=localStorage.getItem(MODE)||'specific';
        const cv=localStorage.getItem(CV)||'';
        const jd=localStorage.getItem(JD)||'';
        body.mode=mode==='general'?'general':'specific';
        if(url.endsWith('/api/analyze-upload')){
          if(!body.data && cv){
            body.cv=cv;
            body.jd=body.jd||jd;
            const next={...init,body:JSON.stringify(body)};
            return originalFetch('/api/analyze',next);
          }
          body.jd=body.jd||jd;
          if(body.data){sessionStorage.setItem(FILE,JSON.stringify({data:body.data,mime:body.mime||'application/pdf'}));}
        } else if(url.endsWith('/api/analyze')){
          body.cv=body.cv||cv;
          body.jd=body.jd||jd;
        } else if(url.endsWith('/api/interview-turn')){
          body.cv=body.cv||cv;
          body.jd=body.jd||jd;
          const file=sessionStorage.getItem(FILE);
          if(file){try{const f=JSON.parse(file);body.cvData=f.data;body.cvMime=f.mime;}catch{}}
        }
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return originalFetch(input,init);
  };
  new MutationObserver(save).observe(document.body,{childList:true,subtree:true});
  save();
})();
