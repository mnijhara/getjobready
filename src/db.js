export const db = {
  getProfile: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_profile'));
    } catch { return null; }
  },
  saveProfile: (email) => {
    localStorage.setItem('gjr_profile', JSON.stringify({ email, joined: new Date().toISOString() }));
  },
  logout: () => {
    localStorage.removeItem('gjr_profile');
  },
  getApplications: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_apps')) || [];
    } catch { return []; }
  },
  saveApplication: (app) => {
    const apps = db.getApplications();
    const existing = apps.findIndex(x => x.id === app.id);
    if (existing >= 0) {
      apps[existing] = { ...apps[existing], ...app, updated: new Date().toISOString() };
    } else {
      apps.push({ ...app, id: app.id || Date.now().toString(), updated: new Date().toISOString() });
    }
    localStorage.setItem('gjr_apps', JSON.stringify(apps));
    return app.id || apps[apps.length - 1].id;
  },
  deleteApplication: (id) => {
    const apps = db.getApplications().filter(x => x.id !== id);
    localStorage.setItem('gjr_apps', JSON.stringify(apps));
  },
  getInterviews: () => {
    try {
      return JSON.parse(localStorage.getItem('gjr_interviews')) || [];
    } catch { return []; }
  },
  saveInterview: (interview) => {
    const interviews = db.getInterviews();
    interviews.push({ ...interview, id: Date.now().toString(), date: new Date().toISOString() });
    localStorage.setItem('gjr_interviews', JSON.stringify(interviews));
  }
};
