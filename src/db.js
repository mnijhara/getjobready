import { supabase } from './getjobready-cloud.js';

const getEmailKey = () => {
  try {
    const p = JSON.parse(localStorage.getItem('gjr_profile'));
    if (p && p.email) {
      return p.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    }
    return 'default';
  } catch {
    return 'default';
  }
};

const getProfileEmail = () => {
  try {
    const p = JSON.parse(localStorage.getItem('gjr_profile'));
    return p?.email ? p.email.trim().toLowerCase() : '';
  } catch {
    return '';
  }
};

const emailToUuid = (email) => {
  if (!email) return null;
  const clean = email.toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (Math.imul(31, h) + clean.charCodeAt(i)) | 0;
  }
  const s = Math.abs(h).toString(16).padStart(8, '0');
  const s2 = Math.abs(Math.imul(h, 37)).toString(16).padStart(12, '0');
  return `${s}-0000-4000-8000-${s2}`;
};

const getCloudUserId = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {}
  return emailToUuid(getProfileEmail());
};

export const db = {
  getProfile: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_profile'));
    } catch { return null; }
  },
  saveProfile: (email) => {
    const cleanEmail = email.trim();
    const profile = { email: cleanEmail, joined: new Date().toISOString() };
    localStorage.setItem('gjr_profile', JSON.stringify(profile));
    db.syncServerData(cleanEmail).then(() => db.pushServerData(cleanEmail)).catch(() => {});
    getCloudUserId().then(uid => {
      if (uid) {
        supabase.from('profiles').upsert({
          id: uid,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0]
        }, { onConflict: 'id' }).catch(() => {});
      }
    });
  },
  logout: () => {
    localStorage.removeItem('gjr_profile');
    try {
      sessionStorage.clear();
    } catch {}
    supabase.auth.signOut().catch(() => {});
  },
  getMasterCV: () => {
    const key = `gjr_master_cv_${getEmailKey()}`;
    return localStorage.getItem(key) || '';
  },
  saveMasterCV: (text) => {
    const key = `gjr_master_cv_${getEmailKey()}`;
    localStorage.setItem(key, text);
    db.pushServerData().catch(() => {});
    getCloudUserId().then(uid => {
      if (uid) {
        supabase.from('master_cvs').update({ is_current: false }).eq('user_id', uid).eq('is_current', true)
          .then(() => supabase.from('master_cvs').insert({ user_id: uid, source_text: text, parsed_data: { source: 'workspace', email: getProfileEmail() }, is_current: true }))
          .catch(e => console.warn('Supabase Master CV save failed', e));
      }
    });
  },
  getApplications: () => {
    const key = `gjr_apps_${getEmailKey()}`;
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
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
    db.pushServerData().catch(() => {});

    getCloudUserId().then(uid => {
      if (uid) {
        supabase.from('job_applications').insert({
          user_id: uid,
          job_description: app.jd || '',
          cv_text: app.cv || '',
          status: 'preparing',
          score: Number(app.result?.score) || null,
          metadata: { role: app.role, report: app.result || {}, email: getProfileEmail() }
        }).catch(e => console.warn('Supabase application save failed', e));
      }
    });
    return updatedApp.id;
  },
  deleteApplication: (id) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const apps = db.getApplications().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(apps));
    db.pushServerData().catch(() => {});
    getCloudUserId().then(uid => {
      if (uid) {
        supabase.from('job_applications').delete().eq('id', id).eq('user_id', uid).catch(() => {});
      }
    });
  },
  getInterviews: () => {
    const key = `gjr_interviews_${getEmailKey()}`;
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  },
  saveInterview: (interview) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const interviews = db.getInterviews();
    const newIv = { ...interview, id: interview.id || Date.now().toString(), date: new Date().toISOString() };
    interviews.unshift(newIv);
    localStorage.setItem(key, JSON.stringify(interviews));
    db.pushServerData().catch(() => {});

    getCloudUserId().then(uid => {
      if (uid) {
        const transcript = (newIv.answers || []).map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
        supabase.from('interviews').insert({
          user_id: uid,
          mode: 'voice',
          role: newIv.role || null,
          score: Number(newIv.score) || null,
          transcript,
          report: newIv
        }).select().single().then(({ data }) => {
          if (data?.id && newIv.answers?.length) {
            const rows = newIv.answers.map(a => ({
              interview_id: data.id,
              question: a.question || null,
              answer: a.answer || null,
              score: a.evaluation?.score || null,
              feedback: a.evaluation || {}
            }));
            supabase.from('interview_answers').insert(rows).catch(() => {});
          }
        }).catch(e => console.warn('Supabase interview save failed', e));
      }
    });
  },
  deleteInterview: (id) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const interviews = db.getInterviews().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(interviews));
    db.pushServerData().catch(() => {});
    getCloudUserId().then(uid => {
      if (uid) {
        supabase.from('interviews').delete().eq('id', id).eq('user_id', uid).catch(() => {});
      }
    });
  },
  syncServerData: async (email) => {
    const targetEmail = email || getProfileEmail();
    if (!targetEmail) return null;
    try {
      const res = await fetch('/api/user-data/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.email) return null;

      const emailKey = targetEmail.replace(/[^a-z0-9]/g, '_');
      const keyCV = `gjr_master_cv_${emailKey}`;
      const keyApps = `gjr_apps_${emailKey}`;
      const keyIvs = `gjr_interviews_${emailKey}`;

      if (data.masterCV) {
        const localCV = localStorage.getItem(keyCV) || '';
        if (!localCV || data.masterCV.length >= localCV.length) {
          localStorage.setItem(keyCV, data.masterCV);
        }
      }

      if (Array.isArray(data.applications) && data.applications.length) {
        const localApps = db.getApplications();
        const mergedMap = new Map();
        [...data.applications, ...localApps].forEach(a => { if (a && a.id) mergedMap.set(String(a.id), a); });
        localStorage.setItem(keyApps, JSON.stringify(Array.from(mergedMap.values())));
      }

      if (Array.isArray(data.interviews) && data.interviews.length) {
        const localIvs = db.getInterviews();
        const mergedMap = new Map();
        [...data.interviews, ...localIvs].forEach(iv => { if (iv && iv.id) mergedMap.set(String(iv.id), iv); });
        localStorage.setItem(keyIvs, JSON.stringify(Array.from(mergedMap.values())));
      }

      window.dispatchEvent(new CustomEvent('gjr_cloud_synced'));
      return data;
    } catch (e) {
      console.warn('Server sync failed', e);
      return null;
    }
  },
  pushServerData: async (email) => {
    const targetEmail = email || getProfileEmail();
    if (!targetEmail) return;
    try {
      const masterCV = db.getMasterCV();
      const applications = db.getApplications();
      const interviews = db.getInterviews();
      await fetch('/api/user-data/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, masterCV, applications, interviews })
      });
    } catch (e) {
      console.warn('Server push failed', e);
    }
  },
  syncFromCloud: async () => {
    const targetEmail = getProfileEmail();
    if (targetEmail) {
      await db.syncServerData(targetEmail);
    }
    const uid = await getCloudUserId();
    if (!uid) return;

    if (targetEmail) {
      db.saveProfile(targetEmail);
    }

    // 1. Sync Master CV
    const localCVKey = `gjr_master_cv_${getEmailKey()}`;
    const localCV = localStorage.getItem(localCVKey) || '';

    const { data: cvData } = await supabase.from('master_cvs').select('*').eq('user_id', uid).eq('is_current', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (cvData?.source_text) {
      if (!localCV || cvData.source_text.length >= localCV.length) {
        localStorage.setItem(localCVKey, cvData.source_text);
      }
    } else if (localCV && localCV.trim()) {
      // If cloud is empty but laptop has local CV, push it up
      supabase.from('master_cvs').insert({
        user_id: uid,
        title: 'Master CV',
        source_text: localCV,
        is_current: true
      }).catch(() => {});
    }

    // 2. Sync Applications
    const keyApps = `gjr_apps_${getEmailKey()}`;
    const localApps = db.getApplications();

    const { data: appsData } = await supabase.from('job_applications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    
    // If local has apps not yet in Supabase (e.g. laptop created before RLS fix), upload them
    if (localApps && localApps.length) {
      for (const la of localApps) {
        const alreadyInCloud = (appsData || []).some(ca => String(ca.id) === String(la.id) || (ca.company === (la.company || la.role) && ca.cv_text === la.cv));
        if (!alreadyInCloud) {
          supabase.from('job_applications').insert({
            user_id: uid,
            company: la.company || la.role || 'Role-specific Application',
            job_description: la.jd || '',
            cv_text: la.cv || '',
            status: 'evaluated',
            score: Number(la.result?.score || la.score) || null,
            metadata: { role: la.role || la.company, report: la.result || { score: la.score }, email: targetEmail }
          }).catch(() => {});
        }
      }
    }

    if (appsData && appsData.length) {
      const merged = [...localApps];
      for (const a of appsData) {
        const id = String(a.id);
        const meta = a.metadata || {};
        const role = meta.role || a.company || 'Role-specific CV';
        const company = a.company || (meta.role && meta.role.includes('–') ? meta.role.split('–')[0].trim() : '') || 'Application';
        if (!merged.some(m => m.id === id || (m.role === role && m.cv === a.cv_text))) {
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
      localStorage.setItem(keyApps, JSON.stringify(merged));
    }

    const { data: ivData } = await supabase.from('interviews').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (ivData && ivData.length) {
      const key = `gjr_interviews_${getEmailKey()}`;
      const localIvs = db.getInterviews();
      const merged = [...localIvs];
      for (const iv of ivData) {
        const id = String(iv.id);
        const report = iv.report || {};
        if (!merged.some(m => m.id === id)) {
          merged.push({
            id,
            role: iv.role || report.role || 'Voice Interview',
            score: iv.score != null ? iv.score : report.score || 0,
            date: iv.created_at,
            strengths: report.strengths || [],
            improvements: report.improvements || [],
            nextAction: report.nextAction || '',
            answers: report.answers || [],
            transcript: iv.transcript || report.transcript || ''
          });
        }
      }
      localStorage.setItem(key, JSON.stringify(merged));
    }

    window.dispatchEvent(new CustomEvent('gjr_cloud_synced'));
  }
};

try {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await db.syncFromCloud();
    }
  });
} catch {}
