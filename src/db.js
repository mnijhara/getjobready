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

export const db = {
  getProfile: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_profile'));
    } catch { return null; }
  },
  saveProfile: (email) => {
    localStorage.setItem('gjr_profile', JSON.stringify({ email: email.trim(), joined: new Date().toISOString() }));
  },
  logout: () => {
    localStorage.removeItem('gjr_profile');
    try {
      sessionStorage.clear();
    } catch {}
  },
  getMasterCV: () => {
    const key = `gjr_master_cv_${getEmailKey()}`;
    return localStorage.getItem(key) || '';
  },
  saveMasterCV: (text) => {
    const key = `gjr_master_cv_${getEmailKey()}`;
    localStorage.setItem(key, text);
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
    if (existing >= 0) {
      apps[existing] = { ...apps[existing], ...app, updated: new Date().toISOString() };
    } else {
      apps.push({ ...app, id: app.id || Date.now().toString(), updated: new Date().toISOString() });
    }
    localStorage.setItem(key, JSON.stringify(apps));
    return app.id || apps[apps.length - 1].id;
  },
  deleteApplication: (id) => {
    const key = `gjr_apps_${getEmailKey()}`;
    const apps = db.getApplications().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(apps));
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
    interviews.unshift({ ...interview, id: Date.now().toString(), date: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(interviews));
  },
  deleteInterview: (id) => {
    const key = `gjr_interviews_${getEmailKey()}`;
    const interviews = db.getInterviews().filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(interviews));
  }
};
