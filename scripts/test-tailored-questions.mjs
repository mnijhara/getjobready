import { cleanBullet, truncateAtWord } from './clean-bullet-helper.mjs';

function cleanExtractedCVText(raw){
 if(!raw)return'';
 return raw.replace(/\r\n/g,'\n').replace(/(▪|•|◆|●|\*\s+)/g,'\n• ').split('\n').map(l=>l.trim()).filter(Boolean).join('\n');
}

function detectDomain(cvText, jdText, roleName){
 const context = ((roleName||'') + ' ' + (jdText||'') + ' ' + (cvText||'')).toLowerCase();
 const targetContext = ((roleName||'') + ' ' + (jdText||'')).toLowerCase();
 const isMBA = /\b(mba|pgdm|post\s*graduate\s*diploma|iim|imt|xlri|nmims|sibm|fms|mdi|spjimr|isb|b-school|business school|management trainee)\b/i.test(context);

 if (/\b(software|developer|engineer|backend|frontend|fullstack|devops|data science|machine learning|ai engineer|cloud engineer|sde)\b/i.test(targetContext)) return 'Technology';
 if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|merchandising|territory)\b/i.test(targetContext)) return 'Marketing';
 if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(targetContext)) return 'Finance';
 if (/\b(consulting|strategy consulting|management consulting|operations consulting|supply chain|scm|logistics|procurement|lean six sigma)\b/i.test(targetContext)) return 'Consulting';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp|employee engagement)\b/i.test(targetContext)) return 'HR';

 if (isMBA) {
  if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|campaign)\b/i.test(context)) return 'Marketing';
  if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(context)) return 'Finance';
  if (/\b(consulting|management consulting|strategy consulting|operations consulting|supply chain|scm|logistics|procurement)\b/i.test(context)) return 'Consulting';
  if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
  return 'General Management';
 }

 if (/\b(software\s*engineer|software\s*developer|developer|coding|backend|frontend|full\s*stack|algorithms|data structures|web\s*development|distributed systems|devops|react|node|golang|c\+\+|java\b|python|typescript|computer science|b\.?tech|b\.?e\b|microservices|rest apis|sql|database|cloud|leetcode|codeforces|codechef)\b/i.test(context)) {
  return 'Technology';
 }

 if (/\b(marketing|brand|campaign|consumer insights|trade marketing|growth marketing)\b/i.test(context)) return 'Marketing';
 if (/\b(finance|valuation|equity|portfolio|cfa|financial analyst|investment banking)\b/i.test(context)) return 'Finance';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
 if (/\b(management consulting|strategy consulting|consulting analyst|supply chain consulting)\b/i.test(context)) return 'Consulting';

 return 'General';
}

function generateTailoredCVQuestions(cvText,jd,role){
 const rawCv=cleanExtractedCVText(cvText||'');
 const lines=rawCv.split(/\n/).map(l=>l.replace(/^[•\-▪*◆]\s*/,'').trim()).filter(Boolean);
 const candName=(lines[0]||'').replace(/[^a-zA-Z\s]/g,'').trim();
 
 const isHeader = l => /^(EDUCATION|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|KEY PROJECTS|PROJECTS|TECHNICAL SKILLS|SKILLS|ACHIEVEMENTS|LEADERSHIP|CERTIFICATIONS|SUMMARY|CONTACT|CURRICULUM VITAE|RESUME)$/i.test(l) || /^(Education|Experience|Projects|Skills|Achievements|Leadership):/i.test(l);
 const useful=lines.filter(l=>l.length>=40 && !isHeader(l) && (!candName || !l.toLowerCase().includes(candName.toLowerCase())));
 
 const projectLines=useful.filter(l=>/project|developed|built|implemented|designed|created|intern|experience|worked|streamlined|engineered|architected|authored|scaled/i.test(l));
 const p1=projectLines[0] || useful[0] || '';
 const p2=projectLines.find(l => l !== p1) || useful.find(l => l !== p1) || '';
 
 const cleanBulletForPrompt = s => truncateAtWord(cleanBullet(s.replace(/^(project|experience|internship|coding panda|sync engine|travelgen ai|edusphere)\s*[:—\-]\s*/gi, '')), 105);
 const cleanProject1 = p1 ? cleanBulletForPrompt(p1) : '';
 const cleanProject2 = p2 ? cleanBulletForPrompt(p2) : '';
 
 const target=String(role||jd||'').trim();
 const domain=detectDomain(cvText, jd, role);
 
 const q1='Walk me through your background and the experience or project on your CV that you are most proud of. What did you personally contribute?';
 const q2=cleanProject1 ? `Your CV mentions "${cleanProject1}". What was the situation, what was your responsibility, what did you personally do, and what was the outcome?` : 'Tell me about one project or experience on your CV. What problem were you solving, what did you personally do, and what was the outcome?';
 const q3=cleanProject2 ? `Your CV also highlights "${cleanProject2}". In that work, what was the biggest technical or operational challenge you encountered, and how did you resolve it?` : 'Tell me about one project or experience from your CV in more depth. What was the biggest challenge and how did you handle it?';
 const q4='How have you used AI in your job, internship, or projects? Please share a specific example of how you used AI to improve your work, solve a problem, or become more effective.';
 const q5=domain==='Technology'
  ? 'Tell me about a difficult problem, bug, architectural setback, or unexpected roadblock you actually experienced in your technical projects. How did you debug or resolve it?'
  : 'Tell me about a difficult problem, setback, disagreement, or unexpected challenge you actually experienced in the work or projects listed on your CV. How did you respond?';
 const q6=target ? `If you joined the ${truncateAtWord(target,70)} team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?` : 'If you joined this team tomorrow, what would you want to learn first, and how would you use the experience already shown on your CV to contribute?';
 return [q1,q2,q3,q4,q5,q6];
}

function getSafeInterviewQuestions(cachedQuestions, cv, jd, roleName) {
 const fresh = generateTailoredCVQuestions(cv, jd, roleName);
 if (!Array.isArray(cachedQuestions) || cachedQuestions.length < 5) return fresh;
 const candName = (cv || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
 const domain = detectDomain(cv, jd, roleName);
 const isCorrupted = cachedQuestions.some(q => {
  if (typeof q !== 'string' || !q.trim()) return true;
  if (candName && candName.length > 3 && new RegExp(`\\bat\\s+${candName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i').test(q)) return true;
  if (/\bat\s+[^.]*\b(Backend Engineer|Software Engineer|Full Stack|Developer|Student|Candidate)\b/i.test(q)) return true;
  if (domain === 'Technology' && (/\bdealer\b/i.test(q) || /background in Consulting/i.test(q))) return true;
  return false;
 });
 return isCorrupted ? fresh : cachedQuestions;
}

const VIJIT_CV = `Vijit Vishnoi
Backend Engineer | Full Stack Developer | Software Engineer
Education: Indian Institute of Information Technology, Ranchi — B.Tech Computer Science & Engineering, 2023-2027, CGPA 8.5/10
Experience: Coding Panda — Full Stack Intern, Sept 2025-Nov 2025
Coding Panda: Streamlined test case batch storage with Cloudflare R2; designed and integrated Judge 0 execution APIs with real-time execution, error diagnostics and resource tracking; partnered with senior developers in Agile to scale a basic compiler into a production-grade platform supporting 5+ languages.
Coding Panda technologies: JavaScript, TypeScript, Express, Node.js, Next.js, MongoDB, OAuth, Tailwind CSS, Monaco Editor, Cloudflare R2
Achievements: 800+ algorithmic challenges across Codeforces, CodeChef and LeetCode; 3-Star CodeChef, Knight LeetCode, Pupil Codeforces; authored CI-validated automated boundary tests exposing a Windows session bug.
Project: Sync Engine — real-time collaborative code editor using Go and React, custom CRDT engine with fractional indexing for state consistency across concurrent edits; Upstash Redis Pub/Sub and Gorilla WebSockets; 50 ms adaptive batching; write-behind Go cache with 5-second debounced ticker to MongoDB Atlas; isolated remote execution for live multi-language compilation.
Project: TravelGen AI — Go/Gin backend and React/TypeScript frontend; processes 5+ parameters to generate itineraries up to 14 days; LLM-driven data pipeline with strict JSON schemas and 50+ data points per query; React-Leaflet route visualizer with up to 15+ daily activity markers.
Project: Edusphere — Node.js, Express, React, Sequelize and MySQL LMS; stress-tested under 200 concurrent users with 100% API success rate; RBAC with JWT; 20+ REST APIs.
Technical skills: C, C++, Java, Go, JavaScript, Python, TypeScript, HTML, Tailwind CSS, React.js, Next.js, gRPC, Express, Node.js, REST APIs, Socket.IO, MongoDB, MySQL, Redis, Docker, Kubernetes, AWS, GCP, Azure, CI/CD, Cloudflare R2, Git, GitHub, VS Code, Linux, Figma, Jira.
Coursework: DSA, OOP, DBMS, Operating Systems, Artificial Intelligence, Computer Networks, Software Engineering, System Design.
Leadership: led a 3-person engineering team for the Adobe Hackathon; advanced past 50,000+ teams to the Semifinals; progressed from Vice-Captain to Captain of the College Table Tennis team, mentoring 14 peers and winning first place at the Inter-IIIT Sports Meet 2025 among 20 teams.`;

console.log('--- GENERATED QUESTIONS FOR VIJIT ---');
const qs = generateTailoredCVQuestions(VIJIT_CV, '', 'Backend Engineer');
qs.forEach((q, i) => console.log(`Q${i+1}: ${q}`));

console.log('\n--- SANITIZING OLD CORRUPTED CACHED QUESTIONS ---');
const oldCorrupted = [
  'Tell me about yourself — your background in Consulting, your academic journey, and the one experience or project you\'re most proud of so far.',
  'In your CV, you mention "Streamlined test case batch storage with Cloudflare R2" — walk me through...',
  'Tell me about a major project at Vijit Vishnoi Backend Engineer. What was your personal ownership...',
  'How are you using AI tools — like ChatGPT, Claude, Copilot, or analytics frameworks...',
  'Describe a time when you faced conflict with a team member, dealer, or stakeholder...',
  'If you joined this team tomorrow, what\'s your 30-day plan...'
];

const sanitized = getSafeInterviewQuestions(oldCorrupted, VIJIT_CV, '', 'Backend Engineer');
console.log('Were corrupted questions replaced?', sanitized !== oldCorrupted);
sanitized.forEach((q, i) => console.log(`Sanitized Q${i+1}: ${q}`));
