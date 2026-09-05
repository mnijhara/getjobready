import { db, normalizeEmail } from './db.js';
import { supabase } from './getjobready-cloud.js';
import { logEvent } from './telemetry.js';

function patchLoginCopy() {
  const replace = () => {
    for (const node of document.querySelectorAll('p,span,small')) {
      if (node.textContent?.includes("We'll save your CVs and interview history securely on your device.")) {
        node.textContent = 'Your CV, applications and interview history will sync securely across your devices.';
      }
    }
  };
  replace();
  const observer = new MutationObserver(replace);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  setTimeout(() => observer.disconnect(), 15_000);
}

// Background sync on focus and visibility
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    db.syncFromCloud().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      db.syncFromCloud().catch(() => {});
    }
  });
  window.addEventListener('online', () => {
    db.syncFromCloud().catch(() => {});
  });

  try {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        logEvent('auth_session_detected', { event });
        const email = normalizeEmail(session.user.email);
        if (email) {
          db.saveProfile(email);
        }
        await db.syncFromCloud().catch(() => {});
      }
    });
  } catch {}

  setTimeout(patchLoginCopy, 300);
}
