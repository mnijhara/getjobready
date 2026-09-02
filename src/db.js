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

const getCloudUser = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
  } catch {
    return null;
  }
};

export const db = {
  getProfile: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_profile'));
    } catch { return null; }
  },
  saveProfile: (email) => {
    const profile = { email: email.trim(), joined: new Date().toISOString() };
    localStorage.setItem('gjr_profile', JSON.stringify(profile));
    getCloudUser().then(user => {
      if (user) {
        supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || email.split('@')[0]
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
    getCloudUser().then(user => {
      if (user) {
        supabase.from('master_cvs').update({ is_current: false }).eq('user_id', user.id).eq('is_current', true)
          .then(() => supabase.from('master_cvs').insert({ user_id: user.id, source_text: text, parsed_data: { source: 'workspace' }, is_current: true }))
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

    getCloudUser().then(user => {
      if (user) {
        supabase.from('job_applications').insert({
          user_id: user.id,
          job_description: app.jd || '',
          cv_text: app.cv || '',
          status: 'preparing',
          score: Number(app.result?.score) || null,
          metadata: { role: app.role, report: app.result || {} }
        }).catch(e => console.warn('Supabase application save failed', e));
      }
    });
    return updatedApp.id;
  },
  deleteApplication: (id) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const apps = db.getApplications().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(apps));
    getCloudUser().then(user => {
      if (user) {
        supabase.from('job_applications').delete().eq('id', id).eq('user_id', user.id).catch(() => {});
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

    getCloudUser().then(user => {
      if (user) {
        const transcript = (newIv.answers || []).map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
        supabase.from('interviews').insert({
          user_id: user.id,
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
    getCloudUser().then(user => {
      if (user) {
        supabase.from('interviews').delete().eq('id', id).eq('user_id', user.id).catch(() => {});
      }
    });
  },
  syncFromCloud: async () => {
    const user = await getCloudUser();
    if (!user) return;

    db.saveProfile(user.email);

    const { data: cvData } = await supabase.from('master_cvs').select('*').eq('user_id', user.id).eq('is_current', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (cvData?.source_text) {
      const key = `gjr_master_cv_${getEmailKey()}`;
      localStorage.setItem(key, cvData.source_text);
    }

    const { data: appsData } = await supabase.from('job_applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (appsData && appsData.length) {
      const key = `gjr_apps_${getEmailKey()}`;
      const localApps = db.getApplications();
      const merged = [...localApps];
      for (const a of appsData) {
        const id = String(a.id);
        const meta = a.metadata || {};
        const role = meta.role || a.company || 'Role-specific CV';
        if (!merged.some(m => m.id === id || (m.role === role && m.cv === a.cv_text))) {
          merged.push({
            id,
            role,
            company: a.company || '',
            cv: a.cv_text || '',
            jd: a.job_description || '',
            result: meta.report || { score: a.score },
            updated: a.created_at
          });
        }
      }
      localStorage.setItem(key, JSON.stringify(merged));
    }

    const { data: ivData } = await supabase.from('interviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
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
