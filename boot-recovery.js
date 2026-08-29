(() => {
  const SHOW_AFTER = 2200;
  const rootId = 'root';
  const fallbackId = 'gjr-boot-recovery';
  const queryKey = 'gjr_recover';
  let timer;

  const fallback = () => document.getElementById(fallbackId);
  const root = () => document.getElementById(rootId);
  const show = (reason) => {
    const box = fallback();
    if (!box) return;
    box.hidden = false;
    if (reason) {
      const detail = box.querySelector('[data-gjr-boot-detail]');
      if (detail) detail.textContent = 'We hit a loading problem. Tap reload and we’ll start a fresh session.';
    }
  };
  const hide = () => {
    const box = fallback();
    if (box) box.hidden = true;
    clearTimeout(timer);
  };
  const hasApp = () => !!root()?.firstElementChild;

  window.__GJR_BOOT_ERROR__ = null;
  window.addEventListener('error', (event) => {
    window.__GJR_BOOT_ERROR__ = event.error || event.message || 'boot error';
    show(true);
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.__GJR_BOOT_ERROR__ = event.reason || 'boot promise error';
    show(true);
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const box = fallback();
    if (box) {
      const button = box.querySelector('[data-gjr-reload]');
      button?.addEventListener('click', () => {
        const url = new URL(location.href);
        url.searchParams.set(queryKey, Date.now().toString(36));
        location.replace(url.toString());
      });
    }

    // Recover users who may still be controlled by an old PWA/service-worker cache.
    // This is a one-time domain-local cleanup and never touches other sites/caches.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length) {
          for (const reg of regs) await reg.unregister();
          const keys = 'caches' in window ? await caches.keys() : [];
          for (const key of keys) {
            if (/getjobready|workbox|precache|vite/i.test(key)) await caches.delete(key);
          }
          if (navigator.serviceWorker.controller && !new URL(location.href).searchParams.has(queryKey)) {
            const url = new URL(location.href);
            url.searchParams.set(queryKey, Date.now().toString(36));
            location.replace(url.toString());
            return;
          }
        }
      }
    } catch (error) {
      console.warn('[GetJobReady boot recovery]', error);
    }

    timer = setTimeout(() => {
      if (!hasApp()) show(false);
    }, SHOW_AFTER);

    const observer = new MutationObserver(() => {
      if (hasApp()) {
        hide();
        observer.disconnect();
      }
    });
    const target = root();
    if (target) observer.observe(target, { childList: true, subtree: true });
  });
})();
