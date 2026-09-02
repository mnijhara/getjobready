import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lgctkqqgtpnabydukypt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mKG4Ylo2tyeMQMT0CopVXQ_a_icNi20';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

const cloud = { user: null, cv: null, latestApplication: null, hydrated: false };
window.getJobReadyCloud = cloud;

const esc = (s) => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

function toast(message, ok = true) {
  let el = document.getElementById('gjr-cloud-toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'gjr-cloud-toast';
    Object.assign(el.style, {position:'fixed',left:'50%',bottom:'88px',transform:'translateX(-50%)',zIndex:2000,maxWidth:'calc(100vw - 32px)',padding:'12px 16px',borderRadius:'14px',background:'#171e31',color:'#fff',font:'700 13px/1.35 system-ui,sans-serif',boxShadow:'0 12px 35px rgba(0,0,0,.22)',textAlign:'center'});
    document.body.appendChild(el);
  }
  el.textContent = message; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}

function injectStyles() {
  if (document.getElementById('gjr-cloud-style')) return;
  const s = document.createElement('style'); s.id = 'gjr-cloud-style';
  s.textContent = `#gjr-account-btn{appearance:none;border:1px solid #dfe2eb;border-radius:999px;background:#fff;color:#171e31;font:700 12px/1 system-ui,sans-serif;padding:10px 13px;cursor:pointer;box-shadow:0 4px 14px rgba(23,30,49,.07)}#gjr-account-btn.signed{background:#171e31;color:#fff;border-color:#171e31}.gjr-auth-backdrop{position:fixed;inset:0;z-index:3000;background:rgba(12,18,34,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.gjr-auth-card{width:min(430px,100%);background:#fff;border-radius:26px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.3)}.gjr-auth-card h2{margin:0 0 8px;font:800 30px/1.1 Manrope,system-ui,sans-serif;color:#12182a}.gjr-auth-card p{color:#737b8d;line-height:1.5}.gjr-auth-card input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #dfe2eb;border-radius:12px;font:600 15px system-ui;margin:10px 0 12px}.gjr-auth-card button{width:100%;padding:14px;border:0;border-radius:12px;background:#6855e8;color:#fff;font:800 14px system-ui;cursor:pointer}.gjr-auth-close{float:right;border:0;background:#f1f2f6;border-radius:50%;width:34px;height:34px;font-size:20px;cursor:pointer}.gjr-history{margin-top:16px}.gjr-history-row{padding:12px 0;border-bottom:1px solid #eceef3}.gjr-history-row b{display:block}.gjr-history-row span{color:#737b8d;font-size:12px}`;
  document.head.appendChild(s);
}

function authModal() {
  if (document.getElementById('gjr-auth')) return;
  const wrap = document.createElement('div'); wrap.id = 'gjr-auth'; wrap.className = 'gjr-auth-backdrop';
  wrap.innerHTML = `<div class="gjr-auth-card"><button class="gjr-auth-close" id="gjr-auth-close">×</button><div style="font:800 11px system-ui;color:#6855e8;letter-spacing:.08em">YOUR GETJOBREADY ACCOUNT</div><h2>Keep your progress everywhere.</h2><p>Sign in with your email and your CV, applications and interview history will follow you from laptop to mobile.</p><input id="gjr-email" type="email" autocomplete="email" placeholder="you@example.com"><button id="gjr-send">Send secure sign-in link</button><p style="font-size:11px;margin-bottom:0">No password to remember. We use Supabase secure email authentication.</p></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#gjr-auth-close').onclick = () => wrap.remove();
  wrap.querySelector('#gjr-send').onclick = async () => {
    const email = wrap.querySelector('#gjr-email').value.trim();
    if (!email || !email.includes('@')) return toast('Enter a valid email address.', false);
    const btn = wrap.querySelector('#gjr-send'); btn.disabled = true; btn.textContent = 'Sending…';
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    btn.disabled = false; btn.textContent = 'Send secure sign-in link';
    if (error) return toast(error.message, false);
    wrap.innerHTML = `<div style="text-align:center"><div style="font-size:42px">✉️</div><h2>Check your email</h2><p>We sent a secure sign-in link to <b>${esc(email)}</b>. Open it on this device to finish signing in.</p></div>`;
  };
}

async function ensureProfile(user) {
  if (!user) return;
  await supabase.from('profiles').upsert({ id:user.id, email:user.email, full_name:user.user_metadata?.full_name || user.email?.split('@')[0] || null }, { onConflict:'id' });
}

async function hydrate() {
  if (!cloud.user) return;
  await ensureProfile(cloud.user);
  const { data: cv } = await supabase.from('master_cvs').select('*').eq('user_id', cloud.user.id).eq('is_current', true).order('updated_at', {ascending:false}).limit(1).maybeSingle();
  cloud.cv = cv || null;
  const { data: app } = await supabase.from('job_applications').select('*').eq('user_id', cloud.user.id).order('created_at', {ascending:false}).limit(1).maybeSingle();
  cloud.latestApplication = app || null;
  cloud.hydrated = true;
  updateAccountButton();
  fillCVIfEmpty();
  updateProfileStats();
}

function updateAccountButton() {
  const header = document.querySelector('header'); if (!header) return;
  let btn = document.getElementById('gjr-account-btn');
  if (!btn) { btn = document.createElement('button'); btn.id = 'gjr-account-btn'; header.querySelector('.header-actions')?.prepend(btn); }
  btn.className = cloud.user ? 'signed' : '';
  btn.textContent = cloud.user ? (cloud.user.email?.split('@')[0]?.slice(0,14) || 'Account') : 'Sign in';
  btn.onclick = cloud.user ? showAccount : authModal;
}

function fillCVIfEmpty() {
  if (!cloud.cv?.source_text) return;
  const ta = document.querySelector('#cvText');
  if (ta && !ta.value.trim()) { ta.value = cloud.cv.source_text; toast('Your saved Master CV was restored from your account.'); }
}

async function saveCV() {
  if (!cloud.user) return;
  const ta = document.querySelector('#cvText'); const text = ta?.value?.trim();
  if (!text) return;
  const { error } = await supabase.from('master_cvs').update({ is_current:false }).eq('user_id', cloud.user.id).eq('is_current',true);
  if (error) return console.warn('CV archive failed', error);
  const { data, error: insertError } = await supabase.from('master_cvs').insert({ user_id:cloud.user.id, source_text:text, parsed_data:{ source:'cv_match_workspace' }, is_current:true }).select().single();
  if (!insertError) cloud.cv = data;
  else console.warn('CV save failed', insertError);
}

async function saveApplication(result) {
  if (!cloud.user) return null;
  const cv = document.querySelector('#cvText')?.value?.trim() || cloud.cv?.source_text || '';
  const jd = document.querySelector('#jdText')?.value?.trim() || '';
  const { data, error } = await supabase.from('job_applications').insert({ user_id:cloud.user.id, job_description:jd, cv_text:cv, status:'preparing', score:Number(result?.score) || null, metadata:{ source:'cv_match', report:result || {} } }).select().single();
  if (error) { console.warn('Application save failed', error); return null; }
  cloud.latestApplication = data; return data;
}

async function saveInterview() {
  if (!cloud.user) return;
  const text = document.querySelector('#voiceTranscript')?.innerText || '';
  const scoreText = document.querySelector('.feedback-score strong')?.textContent || '';
  const score = Number(scoreText) || null;
  const report = { text, score, captured_at:new Date().toISOString(), page:location.pathname };
  const { data, error } = await supabase.from('interviews').insert({ user_id:cloud.user.id, application_id:cloud.latestApplication?.id || null, mode:'voice', role:null, score, transcript:text, report }).select().single();
  if (error) return console.warn('Interview save failed', error);
  const q = document.querySelector('#voiceQuestion')?.textContent?.trim();
  const answer = document.querySelector('#voiceTranscript p')?.textContent?.trim();
  if (q || answer) await supabase.from('interview_answers').insert({ interview_id:data.id, question:q || null, answer:answer || null, score:null, feedback:{} });
  toast('Interview saved to your GetJobReady account.');
}

async function showAccount() {
  const { data: interviews } = await supabase.from('interviews').select('id,mode,role,score,created_at').eq('user_id',cloud.user.id).order('created_at',{ascending:false}).limit(10);
  const { data: apps } = await supabase.from('job_applications').select('id,company,role,score,status,created_at').eq('user_id',cloud.user.id).order('created_at',{ascending:false}).limit(10);
  const wrap=document.createElement('div'); wrap.className='gjr-auth-backdrop';
  wrap.innerHTML=`<div class="gjr-auth-card"><button class="gjr-auth-close" id="gjr-aclose">×</button><div style="font:800 11px system-ui;color:#6855e8;letter-spacing:.08em">YOUR CLOUD ACCOUNT</div><h2>${esc(cloud.user.email)}</h2><p>Your progress is now tied to your account, not this device.</p><div class="gjr-history"><b>Master CV</b><span style="display:block;color:#737b8d;font-size:12px;margin:5px 0 14px">${cloud.cv ? 'Saved and available on every device' : 'No Master CV saved yet'}</span><b>Interview history</b>${(interviews||[]).length ? interviews.map(i=>`<div class="gjr-history-row"><b>${i.mode==='voice'?'Voice interview':'Interview'}${i.score!=null?' · '+i.score+'/100':''}</b><span>${new Date(i.created_at).toLocaleString()}</span></div>`).join('') : '<p>No interviews saved yet.</p>'}<div style="height:12px"></div><b>Applications</b>${(apps||[]).length ? apps.map(a=>`<div class="gjr-history-row"><b>${esc(a.role||a.company||'Job application')}${a.score!=null?' · '+a.score+'/100':''}</b><span>${esc(a.status||'preparing')}</span></div>`).join('') : '<p>No applications saved yet.</p>'}<div style="height:16px"></div><button id="gjr-signout" style="background:#171e31">Sign out</button></div>`;
  document.body.appendChild(wrap); wrap.querySelector('#gjr-aclose').onclick=()=>wrap.remove();
  wrap.querySelector('#gjr-signout').onclick=async()=>{await supabase.auth.signOut();wrap.remove();toast('Signed out. Your cloud data remains safe.');};
}

function updateProfileStats() {
  const stats = document.querySelectorAll('.profile-page .stats > div');
  if (stats.length && cloud.user) {
    supabase.from('interviews').select('id',{count:'exact',head:true}).eq('user_id',cloud.user.id).then(({count})=>{ if(stats[1]) stats[1].querySelector('b').textContent=String(count||0); });
    supabase.from('master_cvs').select('id',{count:'exact',head:true}).eq('user_id',cloud.user.id).eq('is_current',true).then(({count})=>{ if(stats[2]) stats[2].querySelector('b').textContent=String(count||0); });
  }
}

let lastMode = '';
function observeApp() {
  const mode = document.body.innerText.includes('Your Readiness Report') ? 'results' : document.body.innerText.includes('Interview Feedback') ? 'feedback' : document.body.innerText.includes('CV → Job Match') ? 'resume' : document.body.innerText.includes('AI Mock Interview') ? 'interview' : document.body.innerText.includes('Your career profile') ? 'profile' : 'other';
  if (mode !== lastMode) {
    lastMode = mode;
    if (mode === 'resume') setTimeout(fillCVIfEmpty, 80);
    if (mode === 'results') setTimeout(async()=>{ await saveCV(); const result={ score:Number(document.querySelector('.score-ring strong')?.textContent)||null, headline:document.querySelector('.score-card h2')?.textContent||'', summary:document.querySelector('.score-card p')?.textContent||'', highlights:[...document.querySelectorAll('.insight.good')].map(x=>x.textContent.trim()), gaps:[...document.querySelectorAll('.insight.gap')].map(x=>x.textContent.trim()) }; await saveApplication(result); },150);
    if (mode === 'feedback') setTimeout(saveInterview,150);
    if (mode === 'profile') setTimeout(updateProfileStats,150);
  }
  updateAccountButton();
}

injectStyles();
supabase.auth.getSession().then(async ({data}) => { cloud.user=data.session?.user||null; await hydrate(); });
supabase.auth.onAuthStateChange(async (_event, session) => { cloud.user=session?.user||null; cloud.hydrated=false; if(cloud.user) await hydrate(); updateAccountButton(); });
new MutationObserver(observeApp).observe(document.documentElement,{subtree:true,childList:true});
setTimeout(observeApp,300);
