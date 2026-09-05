import { db } from './db.js';
import { supabase } from './getjobready-cloud.js';
import { logEvent } from './telemetry.js';

const PENDING_EMAIL = 'gjr_pending_auth_email';
const LAST_LINK = 'gjr_last_auth_link_at';
const LINK_COOLDOWN_MS = 45_000;

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function localProfile(email) {
  try { return JSON.parse(localStorage.getItem('gjr_profile') || 'null'); } catch { return null; }
}

function saveLocalProfile(email) {
  const old = localProfile(email);
  localStorage.setItem('gjr_profile', JSON.stringify({
    email,
    joined: old?.joined || new Date().toISOString()
  }));
}

function toast(message, ok = true) {
  let el = document.getElementById('gjr-auth-gateway-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gjr-auth-gateway-toast';
    Object.assign(el.style, {
      position:'fixed', left:'50%', bottom:'88px', transform:'translateX(-50%)', zIndex:5000,
      maxWidth:'min(520px,calc(100vw - 32px))', padding:'13px 16px', borderRadius:'14px',
      background:ok?'#171e31':'#8b1e3f', color:'#fff', font:'700 13px/1.35 system-ui,sans-serif',
      boxShadow:'0 12px 35px rgba(0,0,0,.22)', textAlign:'center'
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 4200);
}

async function currentSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (error) {
    logEvent('auth_session_check_error', {}, 'error', error?.message || 'Could not read auth session');
    return null;
  }
}

async function ensureAuthenticatedProfile(session, email) {
  if (!session?.user?.id) return false;
  const { error } = await supabase.from('profiles').upsert({
    id: session.user.id,
    email: email || session.user.email,
    full_name: session.user.user_metadata?.full_name || (email || session.user.email || '').split('@')[0] || null
  }, { onConflict:'id' });
  if (error) {
    logEvent('auth_profile_sync_error', {status:error.code || ''}, 'error', error.message);
    toast('Your account signed in, but profile sync failed. Please retry.', false);
    return false;
  }
  return true;
}

async function sendMagicLink(email) {
  const now = Date.now();
  const last = Number(localStorage.getItem(LAST_LINK) || 0);
  if (now - last < LINK_COOLDOWN_MS) {
    toast('Check your email for the sign-in link. You can request another link shortly.');
    return false;
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: true
    }
  });
  if (error) {
    logEvent('auth_link_error', {}, 'error', error.message);
    toast(error.message || 'Could not send the sign-in link.', false);
    return false;
  }
  localStorage.setItem(PENDING_EMAIL, email);
  localStorage.setItem(LAST_LINK, String(now));
  logEvent('auth_link_requested');
  toast('Check your email to finish sign-in. Your CV, applications and interview history will sync across devices.');
  return true;
}

function patchLoginCopy() {
  const replace = () => {
    const nodes = [...document.querySelectorAll('p,span,small')];
    for (const node of nodes) {
      if (node.textContent?.includes("We'll save your CVs and interview history securely on your device.")) {
        node.textContent = 'Your CV, applications and interview history will sync securely across your devices.';
      }
    }
  };
  replace();
  const observer = new MutationObserver(replace);
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true});
  setTimeout(() => observer.disconnect(), 15_000);
}

const originalSaveProfile = db.saveProfile.bind(db);
const originalSaveMasterCV = db.saveMasterCV.bind(db);
const originalSaveApplication = db.saveApplication.bind(db);
const originalSaveInterview = db.saveInterview.bind(db);
const originalSyncFromCloud = db.syncFromCloud?.bind(db);

// Before real authentication exists, keep data local and never manufacture a fake UUID.
db.saveProfile = (email) => {
  const clean = cleanEmail(email);
  if (!clean || !clean.includes('@')) return;
  saveLocalProfile(clean);
  currentSession().then(async session => {
    if (session?.user) {
      await ensureAuthenticatedProfile(session, clean);
      logEvent('auth_session_detected');
      try { await db.syncFromCloud(); } catch (error) { logEvent('cloud_sync_error', {}, 'error', error?.message || 'Cloud sync failed'); }
      return;
    }
    await sendMagicLink(clean);
  }).catch(error => {
    logEvent('auth_gateway_error', {}, 'error', error?.message || 'Authentication failed');
    toast('Could not start sign-in. Please try again.', false);
  });
};

db.saveMasterCV = text => {
  const key = (() => {
    try { const p = JSON.parse(localStorage.getItem('gjr_profile') || 'null'); return `gjr_master_cv_${p?.email ? p.email.toLowerCase().trim().replace(/[^a-z0-9]/g,'_') : 'default'}`; } catch { return 'gjr_master_cv_default'; }
  })();
  if (String(text || '').trim()) localStorage.setItem(key, String(text).trim());
  currentSession().then(session => {
    if (session?.user) return originalSaveMasterCV(text);
    logEvent('cloud_write_deferred', {entity:'master_cv'});
  }).catch(error => logEvent('cloud_write_error', {entity:'master_cv'}, 'error', error?.message || 'Master CV sync failed'));
};

db.saveApplication = app => {
  const id = originalSaveApplication(app);
  currentSession().then(session => {
    if (session?.user) return originalSaveApplication(app);
    logEvent('cloud_write_deferred', {entity:'application'});
  }).catch(error => logEvent('cloud_write_error', {entity:'application'}, 'error', error?.message || 'Application sync failed'));
  return id;
};

db.saveInterview = interview => {
  originalSaveInterview(interview);
  currentSession().then(session => {
    if (session?.user) return originalSaveInterview(interview);
    logEvent('cloud_write_deferred', {entity:'interview'});
  }).catch(error => logEvent('cloud_write_error', {entity:'interview'}, 'error', error?.message || 'Interview sync failed'));
};

// These endpoints no longer exist on the server. Supabase is the cloud source of truth.
db.syncServerData = async () => null;
db.pushServerData = async () => null;

if (originalSyncFromCloud) {
  db.syncFromCloud = async () => {
    const result = await originalSyncFromCloud();
    await new Promise(resolve => setTimeout(resolve, 500));
    const settled = await originalSyncFromCloud();
    logEvent('cloud_sync_complete');
    return settled || result;
  };
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (!session?.user) return;
  const pending = cleanEmail(localStorage.getItem(PENDING_EMAIL) || '');
  const email = cleanEmail(session.user.email || pending);
  if (email) saveLocalProfile(email);
  if (pending) localStorage.removeItem(PENDING_EMAIL);
  logEvent('auth_state_change', {event});
  await ensureAuthenticatedProfile(session, email);
  try {
    await db.syncFromCloud();
  } catch (error) {
    logEvent('cloud_sync_error', {}, 'error', error?.message || 'Cloud sync failed');
  }
});

setTimeout(patchLoginCopy, 300);
