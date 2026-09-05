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
    if (session?.user?.id) return session.user.id;
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
    const profile = { email: cleanEmail, joined: new Date().toISOString() };
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
    try {
      sessionStorage.clear();
    } catch {}
    supabase.auth.signOut().then(null, () => {});
  },
  getMasterCV: () => {
    const canonicalKey = `gjr_master_cv_${getEmailKey()}`;
    let cv = localStorage.getItem(canonicalKey) || '';
    if (cv && cv.trim()) return cv.trim();

    const profile = getProfileEmail();
    const prefix = profile ? profile.split('@')[0] : '';
    const fallbackKeys = [
      prefix ? `gjr_master_cv_${prefix}` : '',
      prefix ? `gjr_master_cv_${prefix}_gmail` : '',
      'gjr_master_cv_default',
      'gjr_master_cv'
    ].filter(Boolean);

    for (const fbKey of fallbackKeys) {
      if (fbKey === canonicalKey) continue;
      try {
        const oldCv = localStorage.getItem(fbKey);
        if (oldCv && oldCv.trim()) {
          localStorage.setItem(canonicalKey, oldCv.trim());
          return oldCv.trim();
        }
      } catch {}
    }
    return '';
  },
  saveMasterCV: (text) => {
    const key = `gjr_master_cv_${getEmailKey()}`;
    localStorage.setItem(key, text);

    getCloudUserId().then(async uid => {
      if (uid) {
        try {
          await supabase.from('master_cvs').update({ is_current: false }).eq('user_id', uid).eq('is_current', true);
          await supabase.from('master_cvs').insert({
            user_id: uid,
            title: 'Master CV',
            source_text: text,
            parsed_data: { source: 'workspace', email: getProfileEmail() },
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
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem(canonicalKey)) || [];
    } catch { items = []; }

    const profile = getProfileEmail();
    const prefix = profile ? profile.split('@')[0] : '';
    const fallbackKeys = [
      prefix ? `gjr_apps_${prefix}` : '',
      prefix ? `gjr_apps_${prefix}_gmail` : '',
      'gjr_apps_default',
      'gjr_apps'
    ].filter(Boolean);

    let foundOld = false;
    for (const fbKey of fallbackKeys) {
      if (fbKey === canonicalKey) continue;
      try {
        const oldItems = JSON.parse(localStorage.getItem(fbKey));
        if (Array.isArray(oldItems) && oldItems.length) {
          for (const oldApp of oldItems) {
            if (oldApp && !items.some(x => String(x.id) === String(oldApp.id) || (x.company === oldApp.company && x.cv === oldApp.cv))) {
              items.push(oldApp);
              foundOld = true;
            }
          }
        }
      } catch {}
    }

    if (foundOld) {
      localStorage.setItem(canonicalKey, JSON.stringify(items));
    }
    return items;
  },
  saveApplication: (app) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const apps = db.getApplications();
    const existing = apps.findIndex(x => x.id === app.id);
    const updatedApp = { ...app, id: app.id || Date.now().toString(), updated: new Date().toISOString() };
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
            metadata: { role: app.role, report: app.result || {}, email: getProfileEmail() }
          });
        } catch (e) {
          console.warn('Supabase application save failed', e);
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
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem(canonicalKey)) || [];
    } catch { items = []; }

    const profile = getProfileEmail();
    const prefix = profile ? profile.split('@')[0] : '';
    const fallbackKeys = [
      prefix ? `gjr_interviews_${prefix}` : '',
      prefix ? `gjr_interviews_${prefix}_gmail` : '',
      'gjr_interviews_default',
      'gjr_interviews'
    ].filter(Boolean);

    let foundOld = false;
    for (const fbKey of fallbackKeys) {
      if (fbKey === canonicalKey) continue;
      try {
        const oldItems = JSON.parse(localStorage.getItem(fbKey));
        if (Array.isArray(oldItems) && oldItems.length) {
          for (const oldIv of oldItems) {
            if (oldIv && !items.some(x => String(x.id) === String(oldIv.id) || (x.role === oldIv.role && x.date === oldIv.date))) {
              items.push(oldIv);
              foundOld = true;
            }
          }
        }
      } catch {}
    }

    if (foundOld) {
      items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      localStorage.setItem(canonicalKey, JSON.stringify(items));
    }
    return items;
  },
  saveInterview: (interview) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const interviews = db.getInterviews();
    const newIv = { ...interview, id: interview.id || Date.now().toString(), date: interview.date || new Date().toISOString() };
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
            report: newIv,
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

    // 1. Sync Master CV
    const localCVKey = `gjr_master_cv_${getEmailKey()}`;
    const localCV = db.getMasterCV();

    try {
      const { data: cvData } = await supabase.from('master_cvs').select('*').eq('user_id', uid).eq('is_current', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (cvData?.source_text && cvData.source_text.trim()) {
        if (!localCV || cvData.source_text.length >= localCV.length) {
          localStorage.setItem(localCVKey, cvData.source_text);
        } else if (localCV && localCV.trim().length > cvData.source_text.trim().length) {
          try {
            await supabase.from('master_cvs').update({ is_current: false }).eq('user_id', uid).eq('is_current', true);
            await supabase.from('master_cvs').insert({
              user_id: uid,
              title: 'Master CV',
              source_text: localCV,
              is_current: true
            });
          } catch {}
        }
      } else if (localCV && localCV.trim()) {
        try {
          await supabase.from('master_cvs').insert({
            user_id: uid,
            title: 'Master CV',
            source_text: localCV,
            is_current: true
          });
        } catch {}
      }
    } catch (e) {
      console.warn('Sync Master CV failed', e);
    }

    // 2. Sync Applications
    const keyApps = `gjr_apps_${getEmailKey()}`;
    const localApps = db.getApplications();

    try {
      const { data: appsData } = await supabase.from('job_applications').select('*').eq('user_id', uid).order('created_at', { ascending: false });

      if (localApps && localApps.length) {
        for (const la of localApps) {
          const alreadyInCloud = (appsData || []).some(ca => 
            String(ca.id) === String(la.id) || 
            (ca.company === (la.company || la.role) && ca.cv_text === la.cv)
          );
          if (!alreadyInCloud) {
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
            } catch (e) {
              console.warn('Cloud app upload failed', e);
            }
          }
        }
      }

      const { data: freshAppsData } = await supabase.from('job_applications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const cloudApps = freshAppsData || appsData || [];

      if (cloudApps && cloudApps.length) {
        const merged = [...localApps];
        for (const a of cloudApps) {
          const id = String(a.id);
          const meta = a.metadata || {};
          const role = meta.role || a.company || 'Role-specific CV';
          const company = a.company || (meta.role && meta.role.includes('–') ? meta.role.split('–')[0].trim() : '') || 'Application';
          if (!merged.some(m => String(m.id) === id || (m.role === role && m.cv === a.cv_text))) {
            merged.push({
              id,
              role,
              company,
              cv: a.cv_text || '',
              jd: a.job_description || '',
              result: meta.report || { score: a.score },
              score: a.score || meta.report?.score,
              updated: a.created_at
            });
          }
        }
        merged.sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0));
        localStorage.setItem(keyApps, JSON.stringify(merged));
      }
    } catch (e) {
      console.warn('Sync Applications failed', e);
    }

    // 3. Sync Interviews
    const keyIvs = `gjr_interviews_${getEmailKey()}`;
    const localIvs = db.getInterviews();

    try {
      const { data: ivData } = await supabase.from('interviews').select('*').eq('user_id', uid).order('created_at', { ascending: false });

      if (localIvs && localIvs.length) {
        for (const liv of localIvs) {
          const alreadyInCloud = (ivData || []).some(civ => 
            String(civ.id) === String(liv.id) || 
            (civ.role === liv.role && (civ.report?.date === liv.date || civ.created_at === liv.date || Math.abs(new Date(civ.created_at) - new Date(liv.date)) < 60000))
          );
          if (!alreadyInCloud) {
            try {
              const transcript = (liv.answers || []).map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
              await supabase.from('interviews').insert({
                user_id: uid,
                mode: 'voice',
                role: liv.role || null,
                score: Number(liv.score) || null,
                transcript,
                report: liv,
                created_at: liv.date || new Date().toISOString()
              });
            } catch (e) {
              console.warn('Cloud interview upload failed', e);
            }
          }
        }
      }

      const { data: freshIvData } = await supabase.from('interviews').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      const cloudIvs = freshIvData || ivData || [];

      if (cloudIvs && cloudIvs.length) {
        const merged = [...localIvs];
        for (const iv of cloudIvs) {
          const id = String(iv.id);
          const report = iv.report || {};
          const role = iv.role || report.role || 'Voice Interview';
          const date = report.date || iv.created_at;
          const alreadyLocal = merged.some(m => 
            String(m.id) === id || 
            (m.role === role && (m.date === date || Math.abs(new Date(m.date || 0) - new Date(date || 0)) < 60000))
          );
          if (!alreadyLocal) {
            merged.push({
              id,
              role,
              score: iv.score != null ? iv.score : report.score || 0,
              date,
              strengths: report.strengths || [],
              improvements: report.improvements || [],
              nextAction: report.nextAction || '',
              answers: report.answers || [],
              transcript: iv.transcript || report.transcript || ''
            });
          }
        }
        merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        localStorage.setItem(keyIvs, JSON.stringify(merged));
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
  window.addEventListener('focus', () => {
    db.syncFromCloud().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      db.syncFromCloud().catch(() => {});
    }
  });
  try {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await db.syncFromCloud();
      }
    });
  } catch {}
}
