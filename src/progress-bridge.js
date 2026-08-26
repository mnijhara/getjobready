(()=>{
  const KEY='gjr_progress_v1';
  const mark=(key)=>{
    try{
      const current=JSON.parse(sessionStorage.getItem(KEY)||'{}');
      if(current[key]==='completed') return;
      sessionStorage.setItem(KEY,JSON.stringify({...current,[key]:'completed'}));
    }catch{}
    window.dispatchEvent(new CustomEvent('gjr-progress',{detail:{key,status:'completed'}}));
  };
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(...args)=>{
    const response=await originalFetch(...args);
    try{
      const request=args[0];
      const url=typeof request==='string'?request:request?.url||'';
      if(!response.ok)return response;
      if(url.endsWith('/api/analyze')||url.endsWith('/api/analyze-upload')){
        const body=await response.clone().json();
        if(body&&typeof body==='object'&&('score' in body||'headline' in body))mark('cv');
      }else if(url.endsWith('/api/interview-turn')){
        const body=await response.clone().json();
        if(body?.done===true)mark('interview');
      }
    }catch{}
    return response;
  };
})();
