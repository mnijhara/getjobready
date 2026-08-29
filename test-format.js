const text = `MITESH NIJHARA Head of Human Resources · 16+ Years · Fintech · Consumer Tech · High Growth New Delhi | +91 97174 50504 | mnijhara@gmail.com | in mitesh-nijhara      
E X E C U T I V E S U M M A R Y
Senior HR executive with 16+ years building and scaling people functions in high-growth fintech, consumer tech, and services organisations. Founder and C-suite trusted partner — known for building HR infrastructure from scratch, managing 25,000+ employee workforces, driving 3–5x revenue growth, establishing international operations, and leading organisation- wide AI transformation. 
C O R E C O M P E T E N C I E S 
◆ HR Strategy & Organisational Design ◆ Talent Management & Acquisition ◆ Business Partnering & C-Suite Advisory ◆ Culture, Engagement & Leadership Dev. ◆ HR Analytics, HRIS & Compliance ◆ AI Adoption & Future of Work 
P R O F E S S I O N A L E X P E R I E N C E 
Head of Human Resources · Spocto Solutions & Yucollect · Yubi Group · May 2023 – Present 
▪ 2,500+ employees across 2 entities — heading HR for Spocto Solutions and building Yucollect's entire people function from zero: policies, compliance, HRIS, and team structure. 
▪ 3x revenue growth (₹60 Cr → ₹180 Cr) — drove headcount 500 → 2,500, launched Spocto's MENA international operations, and leads the AI Charter across all 9 Yubi Group companies. 
DVP – Human Resources · BYJU'S · Consumer Tech / EdTech · Nov 2019 – May 2023 
▪ 25,000+ sales employees managed — scaled hiring to 200+ hires/month, cut early attrition by 80%, and served as strategic HRBP driving 5x revenue growth across India. 
Senior Manager – HR · Cars24 · Consumer Tech · Apr 2018 – Oct 2019 
▪ 5,000+ employee HR operation — led talent acquisition, analytics, payroll, and HRIS implementation across a rapidly scaling national consumer tech business. 
Manager – HR · HCL Healthcare · Healthcare Services · Oct 2016 – Apr 2018 
▪ Full HRBP scope — managed talent acquisition, performance management, and employee engagement through a period of sustained organisational expansion. 
HR Representative · FedEx · Logistics & Supply Chain · Dec 2013 – Jan 2016 
▪ Large-scale HR operations — delivered employee relations, workforce planning, and compliance for a large diverse logistics workforce in a high-compliance environment. Earlier: AM – HR & IR, Delhi Cargo Service Center (2011–2013) | AM – HR, Hindustan National Glass (2009–2011) 
E D U C A T I O N & L A N G U A G E S 
Post Graduate Diploma in Management (HR) · IMT Nagpur · 2009 
Bachelor of Commerce (B.Com) · Delhi University · 2007 
English (Professional Proficiency) | Hindi (Native)`;

const formatCVHTML = (text) => {
  const lines = text.split('\n');
  let html = '<div class="cv-container">\n';
  let inList = false;
  
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    const isAllUpper = trimmed.toUpperCase() === trimmed;
    const isHeading = hasLetters && isAllUpper && trimmed.length < 60;
    const isBullet = /^[•\-▪*◆]/.test(trimmed);
    
    if (isBullet && !inList) { html += '<ul>\n'; inList = true; } 
    else if (!isBullet && inList) { html += '</ul>\n'; inList = false; }
    
    if (i === 0) {
      html += `<h1>${trimmed}</h1>\n`;
    } else if (isHeading) {
      html += `<h2>${trimmed}</h2>\n`;
    } else if (isBullet) {
      html += `<li>${trimmed.replace(/^[•\-▪*◆]\s*/, '')}</li>\n`;
    } else {
      if (trimmed.includes(' · ') || (trimmed.includes(' - ') && trimmed.length < 120)) {
         html += `<p><strong>${trimmed}</strong></p>\n`;
      } else {
         html += `<p>${trimmed}</p>\n`;
      }
    }
  });
  if (inList) html += '</ul>\n';
  html += '</div>';
  return html;
};

console.log(formatCVHTML(text));
