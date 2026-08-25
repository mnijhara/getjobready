(()=>{
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#analyzeBtn');
    if(!btn)return;
    const mode=sessionStorage.getItem('gjr_cv_mode')||localStorage.getItem('gjr_cv_mode')||'specific';
    if(mode!=='general')return;
    const jd=document.querySelector('#jdText');
    if(jd&&!jd.value){jd.value='GENERAL CV REVIEW — no target job description';jd.dispatchEvent(new Event('input',{bubbles:true}));}
  },true);
})();
