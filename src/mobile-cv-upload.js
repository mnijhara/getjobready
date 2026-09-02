(() => {
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const CV_ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

  const clean = (s) => String(s || '').replace(/\r\n/g, '\n').split('\n').map(x => x.trim()).filter(Boolean).join('\n');
  const setReactTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const toast = (msg, bad = false) => {
    let el = document.getElementById('gjr-cv-upload-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gjr-cv-upload-status';
      Object.assign(el.style, { position:'fixed', left:'16px', right:'16px', bottom:'18px', zIndex:99999, padding:'13px 15px', borderRadius:'14px', background:bad?'#7f1d1d':'#171e31', color:'#fff', font:'700 13px/1.4 system-ui,sans-serif', boxShadow:'0 12px 35px rgba(0,0,0,.25)', textAlign:'center' });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 4500);
  };

  const isCvInput = (input) => {
    const cardLabel = input.closest('.input-card')?.querySelector('.label')?.textContent || '';
    return /your\s*cv/i.test(cardLabel) || input.dataset.gjrCvInput === '1';
  };

  const patchCvInput = (input) => {
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !isCvInput(input)) return;
    input.dataset.gjrCvInput = '1';
    input.accept = CV_ACCEPT;
  };

  const patchExistingInputs = () => document.querySelectorAll('input[type="file"]').forEach(patchCvInput);
  patchExistingInputs();
  new MutationObserver(patchExistingInputs).observe(document.documentElement, { childList: true, subtree: true });

  async function parsePdf(file) {
    try {
      const lib = await import('pdfjs-dist');
      const pdfjs = lib.default?.getDocument ? lib.default : lib;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
      let out = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map(x => x.str || '').join(' ') + '\n';
      }
      return clean(out);
    } catch (e) {
      console.warn('CV PDF.js extraction failed; using server AI fallback.', e);
      return '';
    }
  }

  async function parseDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return clean(result.value);
    } catch (e) {
      console.warn('CV DOCX extraction failed; using server AI fallback.', e);
      return '';
    }
  }

  async function aiExtract(file) {
    if (file.size > MAX_FILE_BYTES) throw new Error('CV file is over 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const data = btoa(binary);
    const mime = file.type || (/.pdf$/i.test(file.name) ? 'application/pdf' : /\.txt$/i.test(file.name) ? 'text/plain' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const r = await fetch('/api/extract-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mime })
    });
    const raw = await r.text();
    let obj = null;
    try { obj = JSON.parse(raw); } catch {}
    if (!r.ok) throw new Error(obj?.error || `CV extraction failed (${r.status})`);
    const text = String(obj?.text || '').trim();
    if (!text) throw new Error('No CV text returned');
    return clean(text);
  }

  async function handle(input, file) {
    if (!file || !isCvInput(input)) return;
    const allowed = /\.(pdf|docx|txt)$/i.test(file.name) || file.type === 'application/pdf' || file.type === 'text/plain' || file.type?.includes('wordprocessingml');
    if (!allowed) { toast('Please choose a PDF, DOCX or TXT CV.', true); return; }
    if (file.size > MAX_FILE_BYTES) { toast('Please keep your CV under 5 MB.', true); return; }

    input.dataset.gjrMobileHandled = '1';
    const textarea = input.closest('.input-card')?.querySelector('textarea') || document.querySelector('textarea');
    if (!textarea) { toast('CV editor is not ready. Please try again.', true); return; }
    toast('Reading your CV…');
    try {
      let text = '';
      if (/\.txt$/i.test(file.name) || file.type === 'text/plain') text = await file.text();
      else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await parsePdf(file);
      else if (/\.docx$/i.test(file.name) || file.type?.includes('wordprocessingml')) text = await parseDocx(file);
      if (!text.trim()) {
        toast('Reading the document securely with AI…');
        text = await aiExtract(file);
      }
      text = clean(text);
      if (!text) throw new Error('No readable CV content was found.');
      setReactTextarea(textarea, text);
      try { sessionStorage.setItem('gjr_cv_text', text); } catch {}
      const label = input.closest('label');
      const nameEl = label?.querySelector('b');
      const statusEl = label?.querySelector('span');
      if (nameEl) nameEl.textContent = file.name;
      if (statusEl) statusEl.textContent = 'CV loaded · ready for review';
      toast('CV uploaded successfully. You can review it now.');
    } catch (e) {
      console.error('CV upload failed', e);
      toast(e?.message === 'CV file is over 5 MB.' ? 'Please keep your CV under 5 MB.' : 'We could not read this CV. Please retry or paste the CV text below.', true);
    }
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !isCvInput(input)) return;
    const file = input.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handle(input, file);
  }, true);
})();
