import { db } from './db.js';
import { supabase } from './getjobready-cloud.js';
import { logEvent } from './telemetry.js';

const PENDING_EMAIL = 'gjr_pending_auth_email';
const LAST_LINK = 'gjr_last_auth_link_at';
const LINK_COOLDOWN_MS = 45_000;

function cleanEmail(value) { return String(value || '').trim().toLowerCase(); }
function localProfile() { try { return JSON.parse(localStorage.getItem('gjr_profile') || 'null'); } catch { return null; } }
function saveLocalProfile(email) {
  const old = localProfile();
  localStorage.setItem('gjr_profile', JSON.stringify({ email, joined: old?.joined || new Date().toISOString() }));
}
function localKey(prefix) {
  const email = cleanEmail(localProfile()?.email);
  return `${prefix}_${email ? email.replace(/[^a-z0-9]/g, '_') : 'default'}`;
}
function toast(message, ok = true) {
  let el = document.getElementById('gjr-auth-gateway-toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'gjr-auth-gateway-toast';
    Object.assign(el.style, {position:'fixed',left:'50%',bottom:'88px',transform:'translateX(-50%)',zIndex:5000,maxWidth:'min(520px,calc(100vw - 32px))',padding:'13px 16px',borderRadius:'14px',background:ok?'#171e31':'#8b1e3f',color:'#fff',font:'700 13px/1.35 system-ui,sans-serif',boxShadow:'0 12px 35px rgba(0,0,0,.22)',textAlign:'center'});
    document.body.appendChild(el);
  }
  el.textContent = message; el.style.opacity = '1'; clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = '0'; }, 4200);
}
async function currentSession() {
  try { const { data } = await supabase.auth.getSession(); return data?.session || null; }
  catch (error) { logEvent('auth_session_check_error', {}, 'error', error?.message || 'Could not read auth session'); return null; }
}
async function ensureAuthenticatedProfile(session, email) {
  if (!session?.user?.id) return false;
  const { error } = await supabase.from('profiles').upsert({
    id: session.user.id,
    email: email || session.user.email,
    full_name: session.user.user_metadata?.full_name || (email || session.user.email || '').split('@')[0] || null
  }, { onConflict:'id' });
  if (error) { logEvent('auth_profile_sync_error', {status:error.code || ''}, 'error', error.message); toast('Your account signed in, but profile sync failed. Please retry.', false); return false; }
  return true;
}
async function sendMagicLink(email) {
  const now = Date.now(), last = Number(localStorage.getItem(LAST_LINK) || 0);
  if (now - last < LINK_COOLDOWN_MS) { toast('Check your email for the sign-in link. You can request another link shortly.'); return false; }
  const { error } = await supabase.auth.signInWithOtp({ email, options:{emailRedirectTo:window.location.origin,shouldCreateUser:true} });
  if (error) { logEvent('auth_link_error', {}, 'error', error.message); toast(error.message || 'Could not send the sign-in link.', false); return false; }
  localStorage.setItem(PENDING_EMAIL,email); localStorage.setItem(LAST_LINK,String(now)); logEvent('auth_link_requested');
  toast('Check your email to finish sign-in. Your CV, applications and interview history will sync across devices.'); return true;
}
function patchLoginCopy() {
  const replace = () => { for (const node of document.querySelectorAll('p,span,small')) if (node.textContent?.includes("We'll save your CVs and interview history securely on your device.")) node.textContent='Your CV, applications and interview history will sync securely across your devices.'; };
  replace(); const observer = new MutationObserver(replace); observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true}); setTimeout(()=>observer.disconnect(),15000);
}
const originalSaveMasterCV = db.saveMasterCV.bind(db);
const originalSaveApplication = db.saveApplication.bind(db);
const originalSaveInterview = db.saveInterview.bind(db);
const originalSyncFromCloud = db.syncFromCloud?.bind(db);

db.saveProfile = email => {
  const clean=cleanEmail(email); if(!clean||!clean.includes('@'))return; saveLocalProfile(clean);
  currentSession().then(async session=>{
    if(session?.user){await ensureAuthenticatedProfile(session,clean);logEvent('auth_session_detected');try{await db.syncFromCloud()}catch(error){logEvent('cloud_sync_error',{},'error',error?.message||'Cloud sync failed')}return;}
    await sendMagicLink(clean);
  }).catch(error=>{logEvent('auth_gateway_error',{},'error',error?.message||'Authentication failed');toast('Could not start sign-in. Please try again.',false)});
};

db.saveMasterCV = text => {
  if(String(text||'').trim()) localStorage.setItem(localKey('gjr_master_cv'),String(text).trim());
  currentSession().then(session=>{if(session?.user)return originalSaveMasterCV(text);logEvent('cloud_write_deferred',{entity:'master_cv'})}).catch(error=>logEvent('cloud_write_error',{entity:'master_cv'},'error',error?.message||'Master CV sync failed'));
};

db.saveApplication = app => {
  const updated={...app,id:app?.id||Date.now().toString(),updated:new Date().toISOString()};
  const key=localKey('gjr_apps'); let list=[]; try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
  const i=list.findIndex(x=>x.id===updated.id); if(i>=0)list[i]={...list[i],...updated};else list.push(updated); localStorage.setItem(key,JSON.stringify(list));
  currentSession().then(session=>{if(session?.user)return originalSaveApplication(updated);logEvent('cloud_write_deferred',{entity:'application'})}).catch(error=>logEvent('cloud_write_error',{entity:'application'},'error',error?.message||'Application sync failed'));
  return updated.id;
};

db.saveInterview = interview => {
  const updated={...interview,id:interview?.id||Date.now().toString(),date:interview?.date||new Date().toISOString()};
  const key=localKey('gjr_interviews'); let list=[]; try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
  list.unshift(updated); localStorage.setItem(key,JSON.stringify(list));
  currentSession().then(session=>{if(session?.user)return originalSaveInterview(updated);logEvent('cloud_write_deferred',{entity:'interview'})}).catch(error=>logEvent('cloud_write_error',{entity:'interview'},'error',error?.message||'Interview sync failed'));
};

db.syncServerData=async()=>null;
db.pushServerData=async()=>null;
if(originalSyncFromCloud){db.syncFromCloud=async()=>{const first=await originalSyncFromCloud();await new Promise(r=>setTimeout(r,500));const settled=await originalSyncFromCloud();logEvent('cloud_sync_complete');return settled||first;};}

supabase.auth.onAuthStateChange(async(event,session)=>{
  if(!session?.user)return;
  const pending=cleanEmail(localStorage.getItem(PENDING_EMAIL)||''),email=cleanEmail(session.user.email||pending);
  if(email)saveLocalProfile(email);if(pending)localStorage.removeItem(PENDING_EMAIL);logEvent('auth_state_change',{event});
  await ensureAuthenticatedProfile(session,email);try{await db.syncFromCloud()}catch(error){logEvent('cloud_sync_error',{},'error',error?.message||'Cloud sync failed');}
});
setTimeout(patchLoginCopy,300);
