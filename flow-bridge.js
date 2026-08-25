(()=>{
const MODE_KEY='gjr_cv_mode', INTERVIEW_KEY='gjr_interview_mode';
const mode=()=>localStorage.getItem(MODE_KEY)||'specific';
const interviewMode=()=>localStorage.getItem(INTERVIEW_KEY)||mode();
const save=(k,v)=>localStorage.setItem(k,v);
const css=`.gjr-flow-modal{position:fixed;inset:0;z-index:9999;background:#11182799;display:grid;place-items:center;padding:20px}.gjr-flow-card{width:min(430px,100%);background:#fff;border-radius:26px;padding:24px;box-shadow:0 25px 80px #0003}.gjr-flow-card h2{margin:8px 0}.gjr-flow-card p{color:#697386;line-height:1.5;font-size:13px}.gjr-flow-option{width:100%;text-align:left;border:1px solid #e1e4ed;background:#fafbfe;border-radius:17px;padding:15px;margin-top:10px;color:#141a2b}.gjr-flow-option strong{display:block;font-size:14px;margin-bottom:4px}.gjr-flow-option span{display:block;color:#737b8c;font-size:11px;line-height:1.45}.gjr-flow-option.primary{background:#171e31;color:#fff;border-color:#171e31}.gjr-flow-option.primary span{color:#cbd0dc}.gjr-flow-close{float:right;border:0;background:#f0f1f5;border-radius:50%;width:32px;height:32px;font-size:20px}`;
function style(){if(document.getElementById('gjr-flow-css'))return;const s=document.createElement('style');s.id='gjr-flow-css';s.textContent=css;document.head.appendChild(s)}
function modal(title,copy,options){style();const m=document.createElement('div');m.className='gjr-flow-modal';m.innerHTML=`<div class="gjr-flow-card"><button class="gjr-flow-close">×</button><span class="eyebrow">GETJOBREADY</span><h2>${title}</h2><p>${copy}</p>${options.map((o,i)=>`<button class="gjr-flow-option ${i===1?'primary':''}" data-flow="${o.id}"><strong>${o.title}</strong><span>${o.desc}</span></button>`).join('')}</div>`;document.body.appendChild(m);m.onclick=e=>{if(e.target===m||e.target.closest('.gjr-flow-close'))return m.remove();const b=e.target.closest('[data-flow]');if(!b)return;m.remove();b.dispatchEvent(new CustomEvent('gjr-flow-choice',{bubbles:true}))};return m}
function openInterview(){modal('Choose your interview','Your interview must use the preparation context you choose.',[{id:'general',title:'🎙️ General CV interview',desc:'Questions based on your CV: projects, experience, achievements, strengths and behavioural readiness.'},{id:'specific',title:'🎯 Role-specific CV + JD interview',desc:'Questions based on your CV plus one specific JD, with role requirements and adaptive role-specific follow-ups.'}]).addEventListener('gjr-flow-choice',e=>{const id=e.detail?.id||e.target?.dataset?.flow;});const m=document.querySelector('.gjr-flow-modal');m.addEventListener('click',e=>{const b=e.target.closest('[data-flow]');if(!b)return;save(INTERVIEW_KEY,b.dataset.flow);save(MODE_KEY,b.dataset.flow);setTimeout(()=>{const r=document.querySelector('[data-module="resume"]');if(r){r.click()}},0)},{once:true})}
// Replace the app's analyze gate for General CV and inject the selected mode into every AI request.
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  if(init&&init.method==='POST'&&url.includes('/api/')){
    try{
      const body=JSON.parse(init.body||'{}');
      const m=mode();
      if(['/api/analyze','/api/analyze-upload','/api/interview-turn','/api/interview-feedback'].some(x=>url.includes(x))){
        body.mode=m;
        body.career=body.career||'job';
        const storedCv=sessionStorage.getItem('gjr_cv_text');
        const storedJd=sessionStorage.getItem('gjr_jd_text');
        if(!body.cv&&storedCv)body.cv=storedCv;
        if(!body.jd&&storedJd)body.jd=storedJd;
        if(url.includes('/api/interview-turn')){
          const d=sessionStorage.getItem('gjr_cv_data'),mm=sessionStorage.getItem('gjr_cv_mime');
          if(d&&mm){body.cvData=d;body.cvMime=mm}
        }
        init={...init,body:JSON.stringify(body)};
      }
    }catch{}
  }
  return nativeFetch(input,init);
};
function storeInputs(){const cv=document.querySelector('#cvText'),jd=document.querySelector('#jdText');if(cv)sessionStorage.setItem('gjr_cv_text',cv.value||'');if(jd)sessionStorage.setItem('gjr_jd_text',jd.value||'')}
document.addEventListener('input',e=>{if(e.target?.id==='cvText'||e.target?.id==='jdText')storeInputs()},{capture:true});
document.addEventListener('change',e=>{if(e.target?.id==='cvFile'){const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=()=>{const raw=String(r.result);sessionStorage.setItem('gjr_cv_data',raw.split(',')[1]||'');sessionStorage.setItem('gjr_cv_mime',f.type||'application/octet-stream')};r.readAsDataURL(f)}}if(e.target?.id==='jdFile')storeInputs()},{capture:true});
document.addEventListener('click',e=>{
  const interview=e.target.closest('[data-module="interview"],#interviewBtn');
  if(interview){e.preventDefault();e.stopImmediatePropagation();openInterview();return}
  const analyze=e.target.closest('#analyzeBtn');
  if(analyze&&mode()==='general'){
    const jd=document.querySelector('#jdText');
    if(jd&&!jd.value){jd.value='GENERAL CV REVIEW — no target job description';jd.dispatchEvent(new Event('input',{bubbles:true}))}
    storeInputs();
  }
},{capture:true});
})();
