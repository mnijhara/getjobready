import { supabase } from './getjobready-cloud.js';

export const normalizeEmail = (raw) => {
  let clean = String(raw || '').trim().toLowerCase();
  if (!clean) return '';
  if (!clean.includes('@')) {
    clean = `${clean}@gmail.com`;
  } else if (clean.endsWith('@gmail')) {
    clean += '.com';
  } else if (clean.endsWith('@yahoo')) {
    clean += '.com';
  } else if (clean.endsWith('@outlook')) {
    clean += '.com';
  } else if (clean.endsWith('@hotmail')) {
    clean += '.com';
  }
  return clean;
};

export const getProfileEmail = () => {
  try {
    const p = JSON.parse(localStorage.getItem('gjr_profile'));
    return p?.email ? normalizeEmail(p.email) : '';
  } catch {
    return '';
  }
};

export const getEmailKey = () => {
  const email = getProfileEmail();
  return email ? email.replace(/[^a-z0-9]/g, '_') : 'default';
};

export const emailToUuid = (email) => {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (Math.imul(31, h) + clean.charCodeAt(i)) | 0;
  }
  const s = Math.abs(h).toString(16).padStart(8, '0');
  const s2 = Math.abs(Math.imul(h, 37)).toString(16).padStart(12, '0');
  return `${s}-0000-4000-8000-${s2}`;
};

export const getCloudUserId = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentEmail = getProfileEmail();
    if (session?.user?.id && session.user.email && normalizeEmail(session.user.email) === currentEmail) {
      return session.user.id;
    }
  } catch {}
  return emailToUuid(getProfileEmail());
};

export const db = {
  getProfile: () => {
    try {
      const p = JSON.parse(localStorage.getItem('gjr_profile'));
      if (p && p.email) {
        const normalized = normalizeEmail(p.email);
        if (p.email !== normalized) {
          p.email = normalized;
          localStorage.setItem('gjr_profile', JSON.stringify(p));
        }
        return p;
      }
      return null;
    } catch { return null; }
  },
  saveProfile: (email) => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;
    const prev = getProfileEmail();
    const existing = db.getProfile();
    const joined = (existing && existing.email === cleanEmail && existing.joined) ? existing.joined : new Date().toISOString();
    if (prev && prev !== cleanEmail) {
      // Switching accounts: purge unscoped legacy keys so they never cross-contaminate
      ['gjr_master_cv', 'gjr_master_cv_default', 'gjr_apps', 'gjr_apps_default', 'gjr_interviews', 'gjr_interviews_default'].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
      try { sessionStorage.clear(); } catch {}
    }
    const profile = { email: cleanEmail, joined };
    localStorage.setItem('gjr_profile', JSON.stringify(profile));
    
    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('profiles').upsert({
            id: uid,
            email: cleanEmail,
            full_name: cleanEmail.split('@')[0]
          }, { onConflict: 'id' });
        } catch {}
      }
    });

    db.syncFromCloud().catch(() => {});
  },
  logout: () => {
    localStorage.removeItem('gjr_profile');
    ['gjr_master_cv', 'gjr_master_cv_default', 'gjr_apps', 'gjr_apps_default', 'gjr_interviews', 'gjr_interviews_default'].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    try {
      sessionStorage.clear();
    } catch {}
    supabase.auth.signOut().then(null, () => {});
  },
  getMasterCV: () => {
    const canonicalKey = `gjr_master_cv_${getEmailKey()}`;
    const cv = localStorage.getItem(canonicalKey) || '';
    if (cv && cv.trim()) return cv.trim();
    if (getEmailKey() === 'default') {
      const fallback = localStorage.getItem('gjr_master_cv_default') || localStorage.getItem('gjr_master_cv') || '';
      return fallback.trim();
    }
    return '';
  },
  saveMasterCV: (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    const currentEmail = getProfileEmail();
    const key = `gjr_master_cv_${getEmailKey()}`;
    const ownerKey = `gjr_master_cv_owner_${getEmailKey()}`;
    localStorage.setItem(key, clean);
    if (currentEmail) localStorage.setItem(ownerKey, currentEmail);

    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('master_cvs').update({ is_current: false }).eq('user_id', uid).eq('is_current', true);
          await supabase.from('master_cvs').insert({
            user_id: uid,
            title: 'Master CV',
            source_text: clean,
            parsed_data: { source: 'workspace', email: currentEmail },
            is_current: true
          });
        } catch (e) {
          console.warn('Supabase Master CV save failed', e);
        }
      }
    });
  },
  getApplications: () => {
    const canonicalKey = `gjr_apps_${getEmailKey()}`;
    try {
      const items = JSON.parse(localStorage.getItem(canonicalKey));
      if (Array.isArray(items)) return items;
    } catch {}
    if (getEmailKey() === 'default') {
      try {
        const fallback = JSON.parse(localStorage.getItem('gjr_apps_default') || localStorage.getItem('gjr_apps')) || [];
        return Array.isArray(fallback) ? fallback : [];
      } catch {}
    }
    return [];
  },
  saveApplication: (app) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const currentEmail = getProfileEmail();
    const apps = db.getApplications();
    const existing = apps.findIndex(x => x.id === app.id);
    const updatedApp = {
      ...app,
      id: app.id || Date.now().toString(),
      user_email: currentEmail,
      updated: app.updated || new Date().toISOString()
    };
    if (existing >= 0) {
      apps[existing] = { ...apps[existing], ...updatedApp };
    } else {
      apps.push(updatedApp);
    }
    localStorage.setItem(key, JSON.stringify(apps));

    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('job_applications').insert({
            user_id: uid,
            company: app.role || app.company || 'Role-specific Application',
            job_description: app.jd || '',
            cv_text: app.cv || '',
            status: 'preparing',
            score: Number(app.result?.score || app.score) || null,
            metadata: { role: app.role, report: app.result || {}, email: currentEmail }
          });
        } catch (e) {
          console.warn('Supabase Application save failed', e);
        }
      }
    });
    return updatedApp.id;
  },
  deleteApplication: (id) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const apps = db.getApplications().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(apps));
    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('job_applications').delete().eq('id', id).eq('user_id', uid);
        } catch {}
      }
    });
  },
  getInterviews: () => {
    const canonicalKey = `gjr_interviews_${getEmailKey()}`;
    try {
      const items = JSON.parse(localStorage.getItem(canonicalKey));
      if (Array.isArray(items)) {
        items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return items;
      }
    } catch {}
    if (getEmailKey() === 'default') {
      try {
        const fallback = JSON.parse(localStorage.getItem('gjr_interviews_default') || localStorage.getItem('gjr_interviews')) || [];
        if (Array.isArray(fallback)) {
          fallback.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
          return fallback;
        }
      } catch {}
    }
    return [];
  },
  saveInterview: (interview) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const currentEmail = getProfileEmail();
    const interviews = db.getInterviews();
    const newIv = {
      ...interview,
      id: interview.id || Date.now().toString(),
      user_email: currentEmail,
      date: interview.date || new Date().toISOString()
    };
    interviews.unshift(newIv);
    localStorage.setItem(key, JSON.stringify(interviews));

    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          const transcript = (newIv.answers || []).map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
          await supabase.from('interviews').insert({
            user_id: uid,
            mode: 'voice',
            role: newIv.role || null,
            score: Number(newIv.score) || null,
            transcript,
            report: { ...newIv, email: currentEmail },
            created_at: newIv.date || new Date().toISOString()
          });
        } catch (e) {
          console.warn('Supabase interview save failed', e);
        }
      }
    });
  },
  deleteInterview: (id) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const interviews = db.getInterviews().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(interviews));
    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('interviews').delete().eq('id', id).eq('user_id', uid);
        } catch {}
      }
    });
  },
  syncServerData: async () => null,
  pushServerData: async () => null,
  syncFromCloud: async () => {
    const targetEmail = getProfileEmail();
    if (!targetEmail) return null;
    const uid = await getCloudUserId();
    if (!uid) return null;

    try {
      await supabase.from('profiles').upsert({
        id: uid,
        email: targetEmail,
        full_name: targetEmail.split('@')[0]
      }, { onConflict: 'id' });
    } catch {}

    const profile = db.getProfile();
    const joinedTime = profile?.joined ? new Date(profile.joined).getTime() : Date.now();
    const isOwnerItem = (item, timestamp) => {
      if (!item) return false;
      const itemEmail = item.user_email || item.email || item.metadata?.email || item.report?.email;
      if (itemEmail && normalizeEmail(itemEmail) !== targetEmail) return false;
      if (!itemEmail && timestamp && new Date(timestamp).getTime() < (joinedTime - 60000)) {
        return false;
      }
      return true;
    };

    // 1. Sync Master CV
    const localCVKey = `gjr_master_cv_${getEmailKey()}`;
    const localCVOwnerKey = `gjr_master_cv_owner_${getEmailKey()}`;
    const localCV = db.getMasterCV();
    const localOwner = localStorage.getItem(localCVOwnerKey);

    try {
      const { data: cvData } = await supabase.from('master_cvs').select('*').eq('user_id', uid).eq('is_current', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (cvData?.source_text && cvData.source_text.trim()) {
        localStorage.setItem(localCVKey, cvData.source_text.trim());
        localStorage.setItem(localCVOwnerKey, targetEmail);
      } else {
        // Cloud has NO master CV for this user
        if (localOwner && localOwner !== targetEmail) {
          localStorage.removeItem(localCVKey);
          localStorage.removeItem(localCVOwnerKey);
        } else if (!localOwner && localCV) {
          // Unverified legacy/leaked local CV on a device with empty cloud — remove to prevent cross-leakage
          localStorage.removeItem(localCVKey);
        } else if (localOwner === targetEmail && localCV) {
          // Genuinely saved by this user locally: upload to cloud
          try {
            await supabase.from('master_cvs').insert({
              user_id: uid,
              title: 'Master CV',
              source_text: localCV,
              parsed_data: { source: 'workspace', email: targetEmail },
              is_current: true
            });
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Sync Master CV failed', e);
    }

    // 2. Sync Applications
    const keyApps = `gjr_apps_${getEmailKey()}`;
    let localApps = db.getApplications();

    try {
      const { data: appsData } = await supabase.from('job_applications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const cloudApps = appsData || [];

      // If local items contain foreign/stale items from an older session, filter them out
      const cleanLocalApps = localApps.filter(la => isOwnerItem(la, la.updated));
      if (cleanLocalApps.length !== localApps.length) {
        localApps = cleanLocalApps;
        localStorage.setItem(keyApps, JSON.stringify(localApps));
      }

      if (cloudApps.length > 0) {
        const merged = cloudApps.map(a => {
          const id = String(a.id);
          const meta = a.metadata || {};
          const role = meta.role || a.company || 'Role-specific CV';
          const company = a.company || (meta.role && meta.role.includes('–') ? meta.role.split('–')[0].trim() : '') || 'Application';
          return {
            id,
            role,
            company,
            cv: a.cv_text || '',
            jd: a.job_description || '',
            result: meta.report || { score: a.score },
            score: a.score || meta.report?.score,
            updated: a.created_at
          };
        });
        localStorage.setItem(keyApps, JSON.stringify(merged));
      } else {
        // Cloud is empty. Upload only genuinely new local apps created in this session
        for (const la of cleanLocalApps) {
          try {
            await supabase.from('job_applications').insert({
              user_id: uid,
              company: la.company || la.role || 'Role-specific Application',
              job_description: la.jd || '',
              cv_text: la.cv || '',
              status: 'evaluated',
              score: Number(la.result?.score || la.score) || null,
              metadata: { role: la.role || la.company, report: la.result || { score: la.score }, email: targetEmail }
            });
          } catch (e) {}
        }
        localStorage.setItem(keyApps, JSON.stringify(cleanLocalApps));
      }
    } catch (e) {
      console.warn('Sync Applications failed', e);
    }

    // 3. Sync Interviews
    const keyIvs = `gjr_interviews_${getEmailKey()}`;
    let localIvs = db.getInterviews();

    try {
      const { data: ivData } = await supabase.from('interviews').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const cloudIvs = ivData || [];

      // Filter out any stale/foreign items
      const cleanLocalIvs = localIvs.filter(liv => isOwnerItem(liv, liv.date));
      if (cleanLocalIvs.length !== localIvs.length) {
        localIvs = cleanLocalIvs;
        localStorage.setItem(keyIvs, JSON.stringify(localIvs));
      }

      if (cloudIvs.length > 0) {
        const merged = cloudIvs.map(iv => {
          const id = String(iv.id);
          const report = iv.report || {};
          const role = iv.role || report.role || 'Voice Interview';
          const date = report.date || iv.created_at;
          return {
            id,
            role,
            score: iv.score != null ? iv.score : report.score || 0,
            date,
            strengths: report.strengths || [],
            improvements: report.improvements || [],
            nextAction: report.nextAction || '',
            answers: report.answers || [],
            transcript: iv.transcript || report.transcript || ''
          };
        });
        localStorage.setItem(keyIvs, JSON.stringify(merged));
      } else {
        // Cloud is empty. Upload only genuinely new local interviews created in this session
        for (const liv of cleanLocalIvs) {
          try {
            const transcript = (liv.answers || []).map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
            await supabase.from('interviews').insert({
              user_id: uid,
              mode: 'voice',
              role: liv.role || null,
              score: Number(liv.score) || null,
              transcript,
              report: { ...liv, email: targetEmail },
              created_at: liv.date || new Date().toISOString()
            });
          } catch (e) {}
        }
        localStorage.setItem(keyIvs, JSON.stringify(cleanLocalIvs));
      }
    } catch (e) {
      console.warn('Sync Interviews failed', e);
    }

    window.dispatchEvent(new CustomEvent('gjr_cloud_synced'));
    return true;
  }
};

if (typeof window !== 'undefined') {
  window.db = db;
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('focus', () => {
      db.syncFromCloud().catch(() => {});
    });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        db.syncFromCloud().catch(() => {});
      }
    });
  }
  try {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await db.syncFromCloud();
      }
    });
  } catch {}
}
