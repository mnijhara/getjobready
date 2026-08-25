(()=>{
  const mode=()=>sessionStorage.getItem('gjr_cv_mode')||localStorage.getItem('gjr_cv_mode')||'specific';
  const context=()=>({cv:sessionStorage.getItem('gjr_cv_text')||'',cvData:sessionStorage.getItem('gjr_cv_data')||'',cvMime:sessionStorage.getItem('gjr_cv_mime')||'',jd:sessionStorage.getItem('gjr_jd_text')||''});
  let prepared=null, preparing=null, fetchPatched=false;
  const nativeFetch=window.fetch.bind(window);
  function remember(body){
    try{
      if(body.cv)sessionStorage.setItem('gjr_cv_text',body.cv);
      if(body.jd&&!String(body.jd).startsWith('GENERAL CV REVIEW'))sessionStorage.setItem('gjr_jd_text',body.jd);
      if(body.data){sessionStorage.setItem('gjr_cv_data',body.data);sessionStorage.setItem('gjr_cv_mime',body.mime||'application/pdf');}
      sessionStorage.setItem('gjr_cv_mode',body.mode||mode());
    }catch{}
  }
  async function prepare(){
    if(prepared?.mode===mode()&&prepared.questions?.length)return prepared;
    if(preparing)return preparing;
    preparing=(async()=>{
      const m=mode(), c=context();
      if(!c.cv&&!c.cvData)return null;
      let d;
      if(c.cvData){
        d=await nativeFetch('/api/analyze-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:c.cvData,mime:c.cvMime||'application/pdf',name:'CV',jd:m==='general'?'':c.jd,career:'job',mode:m})}).then(r=>r.json());
      }else{
        d=await nativeFetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:c.cv,jd:m==='general'?'':c.jd,career:'job',mode:m})}).then(r=>r.json());
      }
      const questions=Array.isArray(d?.interviewQuestions)?d.interviewQuestions.filter(Boolean).slice(0,5):[];
      prepared={mode:m,questions};
      return prepared;
    })().catch(()=>null).finally(()=>{preparing=null});
    return preparing;
  }
  function patchFetch(){
    if(fetchPatched)return;
    fetchPatched=true;
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:(input?.url||'');
      if(init.method==='POST'&&typeof init.body==='string'&&url.includes('/api/')){
        try{
          const body=JSON.parse(init.body);
          if(url.includes('/api/analyze-upload')||url.includes('/api/analyze')){
            const m=mode();
            remember({...body,mode:m});
            if(m==='general'){
              body.jd='';
              body.mode='general';
            }else body.mode='specific';
            init={...init,body:JSON.stringify(body)};
          }
          if(url.includes('/api/interview-turn')){
            const turn=Number(body.turn)||1;
            if(prepared?.questions?.length&&turn===1)body.question=prepared.questions[0];
            const c=context();
            body.mode=mode();
            body.cv=body.cv||c.cv;
            body.jd=body.jd||c.jd;
            init={...init,body:JSON.stringify(body)};
          }
        }catch{}
      }
      return nativeFetch(input,init);
    };
  }
  function armVoiceButton(){
    const btn=document.querySelector('#voiceStart');
    if(!btn||btn.dataset.gjrContext)return;
    btn.dataset.gjrContext='1';
    btn.addEventListener('click',async e=>{
      if(prepared?.questions?.length)return;
      const c=context();
      if(!c.cv&&!c.cvData)return;
      e.preventDefault();e.stopImmediatePropagation();
      btn.disabled=true;btn.textContent='Preparing your interview…';
      const p=await prepare();
      if(!p?.questions?.length){btn.disabled=false;btn.textContent='▶ Start conversation';return}
      window.__gjrInitialQuestion=p.questions[0];
      btn.disabled=false;btn.textContent='▶ Start conversation';
      btn.click();
    },true);
    const original=window.speechSynthesis?.speak?.bind(window.speechSynthesis);
    if(original&&!window.__gjrSpeechContextPatch){
      window.__gjrSpeechContextPatch=true;
      const synth=window.speechSynthesis;
      synth.speak=(utterance)=>{
        const q=window.__gjrInitialQuestion;
        if(q&&utterance){utterance.text=q;window.__gjrInitialQuestion='';}
        return original(utterance);
      };
    }
  }
  function updateLabel(){
    if(!document.querySelector('.voice-stage'))return;
    const head=document.querySelector('.workspace-head h1');
    const p=document.querySelector('.workspace-head p');
    if(head)head.textContent='AI Audio Interview';
    if(p)p.textContent=mode()==='general'?'General interview grounded in your CV.':'Role-specific interview grounded in your CV + JD.';
  }
  function run(){patchFetch();if(document.querySelector('.voice-stage')){updateLabel();armVoiceButton();prepare();}}
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
  addEventListener('load',run);setTimeout(run,100);
})();
