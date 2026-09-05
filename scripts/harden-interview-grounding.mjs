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
 const skillLine=lines.find(l=>/react|node|python|java|sql|aws|cloud|javascript|c\\+\\+/i.test(l))||'';
 const target=String(role||jd||'').trim();
 const q1='Walk me through your background and the experience or project on your CV that you are most proud of. What did you personally contribute?';
 const q2=projectLine?'Your CV mentions "'+truncateAtWord(cleanBullet(projectLine),120)+'". What was the situation, what was your responsibility, what did you personally do, and what was the outcome?':'Tell me about one project or experience on your CV. What problem were you solving, what did you personally do, and what was the outcome?';
 const q3='Tell me about one project or experience from your CV in more depth. What was the biggest challenge and how did you handle it?';
 const q4=skillLine?'Which skill or technology listed on your CV would you be most comfortable discussing in depth? Give me a concrete example of how you used it.':'Which skill from your CV are you strongest in? Give me a concrete example of how you used it.';
 const q5='Tell me about a difficult problem, setback, disagreement, or unexpected challenge you actually experienced in the work or projects listed on your CV. How did you respond?';
 const q6=target?'If you joined the '+truncateAtWord(target,80)+' team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?':'If you joined this team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?';
 return[q1,q2,q3,q4,q5,q6];
}

`;
source=source.slice(0,questionsStart)+safeQuestions+source.slice(evaluateStart);
const evalStart=source.indexOf('function evaluateInterviewTurnLocal(');
const localReviewStart=source.indexOf('function localReview(',evalStart);
if(evalStart<0||localReviewStart<0)throw new Error('Interview evaluator boundaries not found');
const safeEvaluator = `function evaluateInterviewTurnLocal(question,answer,history){
 const cleanAns=String(answer||'').trim(); const words=cleanAns.split(/\\s+/).filter(Boolean); const wordCount=words.length;
 const isGibberish=/(^good\\s*job$|^did\\s*a?\\s*good\\s*job$|^okay$|^ok$|^fine$|^yes$|^no$|^hello$|^test$)/i.test(cleanAns);
 const isRepetitive=wordCount>4&&new Set(words.map(w=>w.toLowerCase())).size<wordCount*0.35;
 let turnScore=0; let note='';
 if(wordCount<=3||isGibberish||cleanAns.length<12){turnScore=0;note='0/100 — The answer is too short or generic. Give a specific example from your CV and explain what you personally did and what happened.';}
 else if(wordCount<10||isRepetitive){turnScore=10;note='10/100 — Severely incomplete. Use a real CV example and explain Situation, Task, Action and Result.';}
 else if(wordCount<25){turnScore=25;note='25/100 — Needs STAR depth. Add context, your individual ownership, the decisions you made and the actual outcome.';}
 else{const hasOwnership=/\\b(i|my)\\b.*\\b(built|designed|implemented|led|developed|analysed|analyzed|created|resolved|integrated|managed|conducted|worked|owned|handled|improved|used|delivered|tested)\\b/i.test(cleanAns)||/\\bmy\\s+(role|responsibility|contribution|work)\\b/i.test(cleanAns);const hasResult=/\\b(result|outcome|impact|improved|reduced|increased|achieved|delivered|learned|success)\\b|%|\\b\\d+\\b/i.test(cleanAns);turnScore=hasOwnership&&hasResult?85:(hasOwnership||hasResult?70:55);note=turnScore>=85?'Strong STAR answer. You explained your contribution and outcome clearly.':turnScore>=70?'Good detail. Make your personal contribution and actual outcome even clearer.':'Add a real CV example and structure it as Situation → Task → Action → Result.';}
 const fillerMatches=cleanAns.match(/\\b(um|uh|er|ah|like|you know|basically|actually|literally)\\b/gi)||[];const fillers=fillerMatches.length;const fillerList=[...new Set(fillerMatches.map(f=>f.toLowerCase()))];if(fillers)note+=' ('+fillers+' verbal crutch'+(fillers>1?'es':'')+' detected.)';
 const q=String(question||'').trim();const quoted=(q.match(/"([^"]+)"/)||[])[1]||'';
 const modelAnswer=quoted?'Use only the exact CV evidence referenced by this question. Situation — explain the real context; Task — state your actual responsibility; Action — describe what you personally did and the technologies or methods you actually used; Result — state the real outcome from your CV. Do not invent metrics, tools, employers or achievements.':'Build this answer from your real CV. Situation — give the context. Task — explain your responsibility. Action — describe what you personally did, using only technologies or methods you actually used. Result — give the real outcome, or what you learned if the CV does not quantify it. Never invent a metric, employer, tool, achievement or responsibility.';
 const prior=Array.isArray(history)?history:[];const allTurns=[...prior,{question:q,answer:cleanAns,evaluation:{score:turnScore}}];const avgScore=Math.round(allTurns.reduce((sum,t)=>sum+(t.evaluation?.score??0),0)/allTurns.length);const improvements=[];if(turnScore<70)improvements.push('Use a real CV example and answer with Situation → Task → Action → Result.');improvements.push('Only state facts, technologies and outcomes supported by the CV or question context.');
 return{done:allTurns.length>=6,evaluation:{score:turnScore,notes:note,modelAnswer,fillers,fillerList},finalFeedback:allTurns.length>=6?{score:avgScore,strengths:turnScore>=70?['Used specific detail and personal ownership where present']:[],improvements,nextAction:'Practise again using real STAR stories from your CV.'}:null};
}

`;
source=source.slice(0,evalStart)+safeEvaluator+source.slice(localReviewStart);
fs.writeFileSync(path,source);
console.log('Interview grounding hardening applied.');
