(()=>{
  const key='gjr_career';
  const read=()=>sessionStorage.getItem(key)||'job';
  const activeCareer=()=>{
    const active=document.querySelector('.career-toggle .active');
    if(!active)return read();
    const text=(active.textContent||'').toLowerCase();
    return text.includes('internship')?'internship':'job';
  };
  const sync=()=>{
    const value=read();
    const buttons=[...document.querySelectorAll('.career-toggle button')];
    if(!buttons.length)return;
    buttons.forEach(button=>{
      const text=(button.textContent||'').toLowerCase();
      button.classList.toggle('active',value==='internship'?text.includes('internship'):text.includes('full-time'));
    });
  };
  document.addEventListener('click',e=>{
    if(e.target.closest('.career-toggle button')){
      setTimeout(()=>{
        sessionStorage.setItem(key,activeCareer());
        sync();
      },0);
    }
  },true);
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if((url==='/api/analyze'||url==='/api/analyze-upload')&&init?.body){
      try{
        const body=JSON.parse(init.body);
        body.career=read();
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return originalFetch(input,init);
  };
  const observer=new MutationObserver(()=>sync());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',sync);
  setTimeout(sync,100);
})();
