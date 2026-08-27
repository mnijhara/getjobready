(()=>{
  const state={retries:0,installed:false,busy:false};
  const native=window.fetch.bind(window);
  const cvText=()=>{try{return sessionStorage.getItem('gjr_cv_text')||''}catch{return ''}};
  const cvData=()=>{try{return sessionStorage.getItem('gjr_cv_data')||''}catch{return ''}};
  function mount(){
    const studio=document.querySelector('.cv-studio');
    if(!studio||studio.dataset.recoveryReady)return;
    studio.dataset.recoveryReady='1';
    const status=studio.querySelector('[data-cv-status]');
    const editor=studio.querySelector('[data-cv-editor]');
    const review=studio.querySelector('[data-cv-analyze]');
    if(!status||!review)return;
    const retry=document.createElement('button');
    retry.type='button'; retry.className='cv-secondary'; retry.textContent='Retry AI review'; retry.hidden=true;
    review.insertAdjacentElement('afterend',retry);
    const originalFetch=window.fetch;
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:(input?.url||'');
      if(url==='/api/improve-cv'&&init.method==='POST'){
        try{
          const response=await originalFetch(input,init);
          if(!response.ok){
            retry.hidden=false;
            const body=await response.clone().json().catch(()=>({}));
            status.textContent=body.error||'AI review is temporarily unavailable. You can retry without losing your CV.';
            status.className='cv-studio-status err';
          }else{retry.hidden=true;state.retries=0}
          return response;
        }catch(error){
          retry.hidden=false;
          status.textContent='AI review could not connect. Retry when your connection is ready.';
          status.className='cv-studio-status err';
          throw error;
        }
      }
      return originalFetch(input,init);
    };
    retry.onclick=async()=>{
      if(state.busy)return;
      state.busy=true;retry.hidden=true;status.textContent='Retrying AI review…';status.className='cv-studio-status';
      try{await review.click()}finally{state.busy=false}
    };
    const original=editor.value.trim();
    if(!original&&!cvData()){
      const text=cvText().trim();
      if(text){editor.value=text;status.textContent='Recovered your saved CV text. You can review it or retry AI review.';status.className='cv-studio-status ok'}
    }
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
  setTimeout(mount,900);
})();
