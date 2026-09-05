(()=>{
  const CV='gjr_cv_context', JD='gjr_jd_context', MODE='gjr_cv_mode', FILE='gjr_cv_file_context';
  const COMMON=new Set('Tell Walk How What Why Describe Explain Can Could Would Your You The In At On One Give Share Which When Where CV'.split(' '));
  const DOMAIN_TERMS=['consulting','banking','marketing','finance','sales','strategy','dealer','client','customer','analytics','hr','human resources'];
  const save=()=>{
    const cv=document.querySelector('#cvText')?.value;
    const jd=document.querySelector('#jdText')?.value;
    if(cv!==undefined) localStorage.setItem(CV,cv);
    if(jd!==undefined && !jd.startsWith('GENERAL CV REVIEW')) localStorage.setItem(JD,jd);
  };
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9+#%.-]+/g,' ').replace(/\s+/g,' ').trim();
  const sourceHas=(source,phrase)=>norm(source).includes(norm(phrase));
  const suspicious=(question,source)=>{
    const q=String(question||'').trim();
    if(!q)return true;
    for(const term of DOMAIN_TERMS){
      const re=new RegExp('\\b'+term.replace(/ /g,'\\s+')+'\\b','i');
      if(re.test(q)&&!sourceHas(source,term))return true;
    }
    const explicit=[
      /background in ([A-Z][A-Za-z0-9&+.-]*(?:\\s+[A-Z][A-Za-z0-9&+.-]*){0,4})/,
      /(?:at|from|with) ([A-Z][A-Za-z0-9&+.-]*(?:\\s+[A-Z][A-Za-z0-9&+.-]*){0,4})/,
      /as (?:a|an) ([A-Z][A-Za-z0-9&+.-]*(?:\\s+[A-Z][A-Za-z0-9&+.-]*){0,4})/
    ];
    for(const re of explicit){
      const m=q.match(re);
      if(m&&m[1]&&!sourceHas(source,m[1]))return true;
    }
    const titleWords=q.match(/\b[A-Z][A-Za-z0-9+.-]*\b/g)||[];
    for(const word of titleWords){
      if(COMMON.has(word)||q.trim().startsWith(word))continue;
      if(!sourceHas(source,word))return true;
    }
    if(/\b\d+(?:\.\d+)?%|\b\d+\+\b/i.test(q)&&!sourceHas(source,q.match(/\b\d+(?:\.\d+)?%|\b\d+\+\b/i)?.[0]||''))return true;
    return false;
  };
  const safeQuestions=(data,cv,jd)=>{
    if(!data||!Array.isArray(data.interviewQuestions))return data;
    const source=String(cv||'')+'\n'+String(jd||'');
    const fallback=[
      'Tell me about the experience or project on your CV that you are most proud of. What did you personally contribute?',
      'Choose one project from your CV. What problem were you solving, what actions did you take, and what was the outcome?',
      'Your CV lists several skills and technologies. Which one did you use most deeply, and where did you apply it?',
      'Tell me about a time in your experience when you took ownership of a difficult problem or deadline.',
      'What experience on your CV best demonstrates how you work with other people, and what did you learn from it?'
    ];
    const out=data.interviewQuestions.map((item,i)=>{
      const q=typeof item==='string'?item:item?.question;
      return suspicious(q,source)?fallback[i]:String(q).trim();
    }).filter(Boolean);
    while(out.length<5)out.push(fallback[out.length]);
    data.interviewQuestions=out.slice(0,5);
    return data;
  };
  document.addEventListener('input',e=>{if(e.target?.id==='cvText'||e.target?.id==='jdText')save();},true);
  document.addEventListener('change',e=>{if(e.target?.id==='cvFile'||e.target?.id==='jdFile')save();},true);
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    if(init?.method==='POST'&&typeof init.body==='string'&&(url.endsWith('/api/analyze-upload')||url.endsWith('/api/analyze')||url.endsWith('/api/interview-turn'))){
      try{
        const body=JSON.parse(init.body);
        const mode=localStorage.getItem(MODE)||'specific';
        const cv=localStorage.getItem(CV)||'';
        const jd=localStorage.getItem(JD)||'';
        body.mode=mode==='general'?'general':'specific';
        if(url.endsWith('/api/analyze-upload')){
          if(!body.data&&cv){body.cv=cv;body.jd=body.jd||jd;return originalFetch('/api/analyze',{...init,body:JSON.stringify(body)});}
          body.jd=body.jd||jd;
          if(body.data)sessionStorage.setItem(FILE,JSON.stringify({data:body.data,mime:body.mime||'application/pdf'}));
        }else if(url.endsWith('/api/analyze')){
          body.cv=body.cv||cv;body.jd=body.jd||jd;
        }else{
          body.cv=body.cv||cv;body.jd=body.jd||jd;
          const file=sessionStorage.getItem(FILE);
          if(file){try{const f=JSON.parse(file);body.cvData=f.data;body.cvMime=f.mime;}catch{}}
        }
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    const response=await originalFetch(input,init);
    if(url.endsWith('/api/analyze')||url.endsWith('/api/analyze-upload')){
      try{
        const copy=response.clone();
        const data=await copy.json();
        const body=init?.body?JSON.parse(init.body):{};
        const safe=safeQuestions(data,body.cv||localStorage.getItem(CV)||'',body.jd||localStorage.getItem(JD)||'');
        return new Response(JSON.stringify(safe),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
      }catch{return response;}
    }
    return response;
  };
  new MutationObserver(save).observe(document.body,{childList:true,subtree:true});
  save();
})();
