const WORKER_URL='https://getjobready-ai-proxy.mnijhara.workers.dev';
const nativeFetch=window.fetch.bind(window);

function extractText(data){
  if(typeof data==='string') return data;
  if(data?.candidates?.[0]?.content?.parts) return data.candidates[0].content.parts.map(p=>p.text||'').join('');
  if(typeof data?.text==='string') return data.text;
  if(typeof data?.output==='string') return data.output;
  if(typeof data?.response==='string') return data.response;
  if(typeof data?.result==='string') return data.result;
  if(data?.result&&typeof data.result==='object') return JSON.stringify(data.result);
  return '';
}

function parseJsonText(text){
  const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');
  return JSON.parse(cleaned);
}

async function generate(prompt,parts=[{text:prompt}]){
  const response=await nativeFetch(`${WORKER_URL}/generate`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      prompt,
      contents:[{parts}],
      model:'gemini-3.7-flash',
      generationConfig:{responseMimeType:'application/json',maxOutputTokens:6000},
      json:true
    })
  });
  const raw=await response.text();
  if(!response.ok) throw new Error(`AI service ${response.status}`);
  const data=JSON.parse(raw);
  const text=extractText(data);
  if(!text) return data;
  return parseJsonText(text);
}

function analysisPrompt(cv,jd,career,mode){
  if(mode==='general') return `You are an expert campus recruiter and CV strategist. Analyse this student's CV WITHOUT assuming a specific job. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in the CV). Questions must test the candidate's actual projects, experience, achievements, strengths, weaknesses, teamwork, ownership, problem solving and behavioural readiness. Do not invent employers, skills, achievements or a target role.\n\nCV:\n${String(cv).slice(0,40000)}`;
  return `You are an expert campus recruiter, CV strategist and career coach. Analyse this student's CV against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly these keys: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4; rewrite only when source evidence supports it and never invent facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 role-specific questions). Prioritise evidence, skills, role fit, measurable impact and realistic campus-placement advice.\n\nCV:\n${String(cv).slice(0,40000)}\n\nJOB DESCRIPTION:\n${String(jd).slice(0,30000)}`;
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  if(!url.startsWith('/api/')) return originalFetch(input,init);
  const path=url.split('?')[0];

  if(path==='/api/ai-status' && (!init.method||init.method==='GET')){
    const r=await originalFetch(`${WORKER_URL}/health`);
    const d=await r.json();
    return new Response(JSON.stringify({
      configured:!!d.ok,
      keySlots:Number(d.configuredKeys||0),
      healthySlots:Number(d.healthyKeys||0),
      model:d.model||'gemini-3.7-flash',
      router:d.router||'5-key round-robin + automatic failover',
      proxy:WORKER_URL
    }),{status:r.status,headers:{'Content-Type':'application/json'}});
  }

  if(path==='/api/analyze' || path==='/api/analyze-upload'){
    try{
      const body=typeof init.body==='string'?JSON.parse(init.body):(init.body||{});
      const mode=body.mode||'specific';
      let prompt,parts;
      if(path==='/api/analyze-upload'){
        const career=body.career||'job';
        prompt=mode==='general'
          ?`You are an expert campus recruiter and CV strategist. Read the attached CV WITHOUT assuming a target job. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 general interview questions grounded in this CV). Questions must cover actual projects, experience, achievements, teamwork, ownership, problem solving and behavioural readiness. Do not invent facts or assume a role.`
          :`You are an expert campus recruiter. Read the attached CV and analyse it against the target job description. Career mode: ${career}. Return ONLY valid JSON with exactly: score (0-100), headline, summary, highlights (max 4), gaps (max 5), cvImprovements (max 5), rewrittenBullets (max 4 without inventing facts), plan (exactly 7 actionable steps), interviewQuestions (exactly 5 role-specific questions). Target JD:\n${String(body.jd||'').slice(0,30000)}`;
        parts=[{text:prompt},{inlineData:{mimeType:body.mime||'application/pdf',data:body.data||''}}];
      }else{
        prompt=analysisPrompt(body.cv||'',body.jd||'',body.career||'job',mode);
        parts=[{text:prompt}];
      }
      const result=await generate(prompt,parts);
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
    }catch(error){
      return new Response(JSON.stringify({error:'AI service unavailable. Please try again.'}),{status:503,headers:{'Content-Type':'application/json'}});
    }
  }

  return originalFetch(input,init);
};
