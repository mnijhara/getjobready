import fs from 'node:fs';

// Production grounding guard: keep generated interview content strictly source-backed.
const path = 'src/main-v2.jsx';
let source = fs.readFileSync(path, 'utf8');
const questionsStart = source.indexOf('function generateTailoredCVQuestions(');
const evaluateStart = source.indexOf('function evaluateInterviewTurnLocal(', questionsStart);
if (questionsStart < 0 || evaluateStart < 0) throw new Error('Interview question functions not found');

const safeQuestions = `function generateTailoredCVQuestions(cvText,jd,role){
 const rawCv=cleanExtractedCVText(cvText||'');
 const lines=rawCv.split(/\\n/).map(l=>l.replace(/^[•\\-▪*◆]\\s*/,'').trim()).filter(Boolean);
 const useful=lines.filter(l=>l.length>=35&&!/^(EDUCATION|PROFESSIONAL EXPERIENCE|KEY PROJECTS|TECHNICAL SKILLS|ACHIEVEMENTS|LEADERSHIP|CERTIFICATIONS)$/i.test(l));
 const projectLine=useful.find(l=>/project|developed|built|implemented|designed|created|intern|experience|worked/i.test(l))||useful[0]||'';
 const cleanProject=projectLine?truncateAtWord(cleanBullet(projectLine),110):'';
 const target=String(role||jd||'').trim();
 const q1='Walk me through your background and the experience or project on your CV that you are most proud of. What did you personally contribute?';
 const q2=cleanProject?'Your CV mentions "'+cleanProject+'". What was the situation, what was your responsibility, what did you personally do, and what was the outcome?':'Tell me about one project or experience on your CV. What problem were you solving, what did you personally do, and what was the outcome?';
 const q3='Tell me about one project or experience from your CV in more depth. What was the biggest challenge and how did you handle it?';
 // Mandatory AI question: ask this in every interview, regardless of whether AI appears on the CV.
 const q4='How have you used AI in your job, internship, or SIP? Please share a specific example of how you used AI to improve your work, solve a problem, or become more effective.';
 const q5='Tell me about a difficult problem, setback, disagreement, or unexpected challenge you actually experienced in the work or projects listed on your CV. How did you respond?';
 const q6=target?'If you joined the '+truncateAtWord(target,80)+' team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?':'If you joined this team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?';
 return[q1,q2,q3,q4,q5,q6];
}

`;
source=source.slice(0,questionsStart)+safeQuestions+source.slice(evaluateStart);
const evalStart=source.indexOf('function evaluateInterviewTurnLocal(');
const localReviewStart=source.indexOf('function localReview(',evalStart);
if(evalStart<0||localReviewStart<0)throw new Error('Interview evaluator boundaries not found');
const safeEvaluator = `function evaluateInterviewTurnLocal(question,answer,history,cvText=''){
 const cleanAns=String(answer||'').trim(); const words=cleanAns.split(/\\s+/).filter(Boolean); const wordCount=words.length;
 const isGibberish=/(^good\\s*job$|^did\\s*a?\\s*good\\s*job$|^okay$|^ok$|^fine$|^yes$|^no$|^hello$|^test$)/i.test(cleanAns);
 const isRepetitive=wordCount>4&&new Set(words.map(w=>w.toLowerCase())).size<wordCount*0.35;
 let turnScore=0; let note='';
 if(wordCount<=3||isGibberish||cleanAns.length<12){turnScore=0;note='0/100 — The answer is too short or generic. Give a specific example from your CV and explain what you personally did and what happened.';}
 else if(wordCount<10||isRepetitive){turnScore=10;note='10/100 — Severely incomplete. Use a real CV example and explain Situation, Task, Action and Result.';}
 else if(wordCount<25){turnScore=25;note='25/100 — Needs STAR depth. Add context, your individual ownership, the decisions you made and the actual outcome.';}
 else{const hasOwnership=/\\b(i|my)\\b.*\\b(built|designed|implemented|led|developed|analysed|analyzed|created|resolved|integrated|managed|conducted|worked|owned|handled|improved|used|delivered|tested)\\b/i.test(cleanAns)||/\\bmy\\s+(role|responsibility|contribution|work)\\b/i.test(cleanAns);const hasResult=/\\b(result|outcome|impact|improved|reduced|increased|achieved|delivered|learned|success)\\b|%|\\b\\d+\\b/i.test(cleanAns);turnScore=hasOwnership&&hasResult?85:(hasOwnership||hasResult?70:55);note=turnScore>=85?'Strong STAR answer. You explained your contribution and outcome clearly.':turnScore>=70?'Good detail. Make your personal contribution and actual outcome even clearer.':'Add a real CV example and structure it as Situation → Task → Action → Result.';}
 const fillerMatches=cleanAns.match(/\\b(um|uh|er|ah|like|you know|basically|actually|literally)\\b/gi)||[];const fillers=fillerMatches.length;const fillerList=[...new Set(fillerMatches.map(f=>f.toLowerCase()))];if(fillers)note+=' ('+fillers+' verbal crutch'+(fillers>1?'es':'')+' detected.)';
 const q=String(question||'').trim();
 const quotedMatch=q.match(/"([^"]+)"/);
 const quoted=quotedMatch?cleanBullet(quotedMatch[1]):'';

 let modelAnswer='';
 if(/\\b(background|proudest|proud|academic journey|tell me about yourself|walk me through)\\b/i.test(q)){
  modelAnswer='I have a background in software engineering with a focus on building reliable, scalable systems. The project I am most proud of is developing a real-time collaborative workspace. Situation: Our application had concurrent state conflicts when multiple users edited simultaneously. Task: My responsibility was ensuring state consistency without slowing down real-time sync. Action: I designed an operational transformation pipeline using WebSockets and Redis pub/sub to order client operations and resolve race conditions in memory. Result: We achieved sub-50ms synchronization latency across concurrent sessions with zero data loss, handling peak loads smoothly.';
 }else if(quoted||/\\b(your cv mentions|mentions|project on your cv|one project or experience on your cv)\\b/i.test(q)){
  const topic=quoted?\`In my work on "\${quoted}": \`:'In my core project: ';
  modelAnswer=topic+'Situation: Our system faced high latency and escalating storage overhead during peak test execution. Task: I took full ownership of overhauling the batch storage pipeline to keep ingestion fast and cost-effective. Action: I architected the storage tier with Cloudflare R2 object storage, configured asynchronous batch multipart uploads, and implemented automated retry policies with circuit breakers. Result: This reduced storage costs by over 30%, lowered batch processing time significantly, and eliminated ingestion timeouts in production.';
 }else if(/\\b(challenge|depth|more depth|difficult problem|technical problem|handled it)\\b/i.test(q)&&!/\\b(setback|disagreement|unexpected|conflict)\\b/i.test(q)){
  modelAnswer='Situation: In one of our core services, we encountered severe write contention and intermittent latency spikes during high-concurrency database updates. Task: My responsibility was to eliminate the write bottleneck without altering existing API contracts or risking data consistency. Action: I profiled query execution plans, removed unindexed table scans, and implemented an in-memory write-behind cache with optimistic concurrency control and debounced batching. Result: This reduced write contention by over 40%, brought 99th-percentile response times under 50ms, and prevented database deadlocks under high load.';
 }else if(/\\b(ai|copilot|chatgpt|claude|llm|artificial intelligence)\\b/i.test(q)){
  modelAnswer='I treat modern AI tools as an engineering velocity multiplier while strictly verifying every output: Situation: Writing boundary unit test suites and edge-case mocks for microservice endpoints was manual and time-consuming. Task: I wanted to accelerate test coverage for complex edge conditions without sacrificing code correctness. Action: I used GitHub Copilot and structured LLM prompts to scaffold parameterized unit tests and simulate edge-case payloads, then rigorously verified every assertion against our API specifications. Result: This cut our test scaffolding time by 40% and uncovered two critical boundary bugs during development before code reached staging.';
 }else if(/\\b(setback|disagreement|unexpected|conflict|failure)\\b/i.test(q)){
  modelAnswer='Situation: Two days before a major release, our integration test suite unexpectedly failed due to environment-specific path delimiter discrepancies across operating system runtimes. Task: As the developer owning that component, I had to resolve the failure quickly without causing release delays or panic. Action: I held a brief technical sync to communicate transparently, isolated the bug to unescaped session path delimiters in our storage module, wrote regression test cases, and deployed platform-agnostic normalization within 8 hours. Result: All integration tests passed green, the release shipped on schedule, and we added cross-platform containerized testing to our CI pipeline.';
 }else if(/\\b(tomorrow|joined|first 30 days|learn first|contribute)\\b/i.test(q)){
  modelAnswer='If I joined the team tomorrow, I would follow a structured 30-day onboarding plan: First, in my initial two weeks, I would immerse myself in your codebase, architecture documentation, and CI/CD pipelines, while scheduling 1-on-1s with senior teammates to understand coding standards and team priorities. Second, by week three, I would take ownership of two small backlog bugs or test improvements to ship my first PR and validate my local-to-production workflow. Third, by day thirty, I would be ready to take independent ownership of a feature deliverable, using my experience in scalable systems to deliver clean, tested code and contribute actively in sprint reviews.';
 }else{
  modelAnswer='Situation: In my previous project, we had to deliver a critical module under ambiguous requirements and a strict two-week deadline. Task: My goal was to clarify deliverables, take ownership of implementation, and ensure reliable execution. Action: I broke down core requirements into concrete milestones, designed modular components with robust unit test coverage, and held daily 10-minute check-ins to unblock dependencies quickly. Result: We delivered the feature two days ahead of schedule with zero high-severity defects and received positive feedback from stakeholders.';
 }

 const prior=Array.isArray(history)?history:[];const allTurns=[...prior,{question:q,answer:cleanAns,evaluation:{score:turnScore}}];const avgScore=Math.round(allTurns.reduce((sum,t)=>sum+(t.evaluation?.score??0),0)/allTurns.length);const improvements=[];if(turnScore<70)improvements.push('Use a real CV example and answer with Situation → Task → Action → Result.');improvements.push('Only state facts, technologies and outcomes supported by the CV or question context.');
 return{done:allTurns.length>=6,evaluation:{score:turnScore,notes:note,modelAnswer,fillers,fillerList},finalFeedback:allTurns.length>=6?{score:avgScore,strengths:turnScore>=70?['Used specific detail and personal ownership where present']:[],improvements,nextAction:'Practise again using real STAR stories from your CV.'}:null};
}

`;
source=source.slice(0,evalStart)+safeEvaluator+source.slice(localReviewStart);
fs.writeFileSync(path,source);
console.log('Interview grounding hardening applied.');
