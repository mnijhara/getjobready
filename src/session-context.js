(()=>{
  const key='gjr_career';
  const sync=()=>{
    const active=document.querySelector('.career-toggle .active');
    if(!active)return;
    const text=(active.textContent||'').toLowerCase();
    sessionStorage.setItem(key,text.includes('internship')?'internship':'job');
  };
  document.addEventListener('click',e=>{
    if(e.target.closest('.career-toggle button')){
      setTimeout(sync,0);
    }
  },true);
  window.addEventListener('load',sync);
})();
