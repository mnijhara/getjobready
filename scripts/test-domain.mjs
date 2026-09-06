function detectDomain(cvText, jdText, roleName){
 const context = ((roleName||'') + ' ' + (jdText||'') + ' ' + (cvText||'')).toLowerCase();
 const targetContext = ((roleName||'') + ' ' + (jdText||'')).toLowerCase();
 const isMBA = /\b(mba|pgdm|post\s*graduate\s*diploma|iim|imt|xlri|nmims|sibm|fms|mdi|spjimr|isb|b-school|business school|management trainee)\b/i.test(context);

 // Target JD / Role takes top precedence if present
 if (/\b(software|developer|engineer|backend|frontend|fullstack|devops|data science|machine learning|ai engineer|cloud engineer|sde)\b/i.test(targetContext)) return 'Technology';
 if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|merchandising|territory)\b/i.test(targetContext)) return 'Marketing';
 if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(targetContext)) return 'Finance';
 if (/\b(consulting|strategy consulting|management consulting|operations consulting|supply chain|scm|logistics|procurement|lean six sigma)\b/i.test(targetContext)) return 'Consulting';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp|employee engagement)\b/i.test(targetContext)) return 'HR';

 // When candidate has MBA / PGDM background, check management domains
 if (isMBA) {
  if (/\b(marketing|brand|sales|trade|fmcg|gtm|consumer|retail|distribution|dealer|campaign)\b/i.test(context)) return 'Marketing';
  if (/\b(finance|banking|valuation|equity|portfolio|cfa|financial|investment|credit|treasury|wealth)\b/i.test(context)) return 'Finance';
  if (/\b(consulting|management consulting|strategy consulting|operations consulting|supply chain|scm|logistics|procurement)\b/i.test(context)) return 'Consulting';
  if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
  return 'General Management';
 }

 // For non-MBA candidates, check Technology BEFORE generic business keywords to prevent
 // "Operating Systems", "system operations", "database operations", or "test strategy"
 // from misclassifying developers into Consulting!
 if (/\b(software\s*engineer|software\s*developer|developer|coding|backend|frontend|full\s*stack|algorithms|data structures|web\s*development|distributed systems|devops|react|node|golang|c\+\+|java\b|python|typescript|computer science|b\.?tech|b\.?e\b|microservices|rest apis|sql|database|cloud|leetcode|codeforces|codechef)\b/i.test(context)) {
  return 'Technology';
 }

 // Non-MBA business domains
 if (/\b(marketing|brand|campaign|consumer insights|trade marketing|growth marketing)\b/i.test(context)) return 'Marketing';
 if (/\b(finance|valuation|equity|portfolio|cfa|financial analyst|investment banking)\b/i.test(context)) return 'Finance';
 if (/\b(human resources|talent acquisition|recruitment|people ops|hrbp)\b/i.test(context)) return 'HR';
 if (/\b(management consulting|strategy consulting|consulting analyst|supply chain consulting)\b/i.test(context)) return 'Consulting';

 return 'General';
}

// Verification cases:
const tests = [
  { name: 'Pure Software Engineer', cv: 'Software Engineer B.Tech Computer Science, React, Node, algorithms', role: '', expected: 'Technology' },
  { name: 'Dev with Operating Systems and db operations', cv: 'Software Engineer, Coursework: Operating Systems, optimized db operations and test strategy', role: '', expected: 'Technology' },
  { name: 'Dev with strategic practice sessions', cv: 'Full Stack Developer with strategic practice sessions on LeetCode', role: '', expected: 'Technology' },
  { name: 'MBA Marketing', cv: 'MBA Marketing from IMT Ghaziabad, sales distribution and FMCG brand management', role: '', expected: 'Marketing' },
  { name: 'MBA Finance', cv: 'PGDM Finance, DCF valuation and equity research', role: '', expected: 'Finance' },
  { name: 'MBA Consulting', cv: 'MBA in Management Consulting, case studies, supply chain and operations consulting', role: '', expected: 'Consulting' },
  { name: 'Role-specific Tech override', cv: 'B.Com student with basic Excel', role: 'Frontend Engineer', expected: 'Technology' },
  { name: 'Role-specific Marketing override', cv: 'B.Tech CS graduate', role: 'Brand Manager FMCG', expected: 'Marketing' }
];

let failed = 0;
for (const t of tests) {
  const actual = detectDomain(t.cv, '', t.role);
  if (actual === t.expected) {
    console.log(`PASS: ${t.name} -> ${actual}`);
  } else {
    console.error(`FAIL: ${t.name} -> expected ${t.expected}, got ${actual}`);
    failed++;
  }
}

if (failed > 0) process.exit(1);
console.log('All detectDomain tests passed!');
