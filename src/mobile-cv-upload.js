(() => {
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const CV_ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
  const SUPPORTED = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  const clean = (s) => String(s || '').replace(/\r\n/g, '\n').split('\n').map(x => x.trim()).filter(Boolean).join('\n');
  const setReactTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inferMime = async (file) => {
    const reported = String(file?.type || '').toLowerCase().split(';')[0].trim();
    try {
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const ascii = String.fromCharCode(...head);
      if (ascii.startsWith('%PDF-')) return 'application/pdf';
      if (ascii.startsWith('PK')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } catch {}
    if (SUPPORTED.includes(reported)) return reported;
    if (/\.pdf$/i.test(file?.name || '')) return 'application/pdf';
    if (/\.txt$/i.test(file?.name || '')) return 'text/plain';
    if (/\.docx$/i.test(file?.name || '')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return reported;
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
    } catch (e) { console.warn('CV PDF.js extraction failed; using server AI fallback.', e); return ''; }
  }
  async function parseDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return clean(result.value);
    } catch (e) { console.warn('CV DOCX extraction failed; using server AI fallback.', e); return ''; }
  }
  async function aiExtract(file, mime) {
    if (file.size > MAX_FILE_BYTES) throw new Error('CV file is over 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const data = btoa(binary);
    const resolvedMime = mime || await inferMime(file);
    if (!SUPPORTED.includes(resolvedMime)) throw new Error('Unsupported CV file type.');
    const r = await fetch('/api/extract-cv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, mime: resolvedMime }) });
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
    if (file.size > MAX_FILE_BYTES) { toast('Please keep your CV under 5 MB.', true); return; }
    const mime = await inferMime(file);
    const allowed = SUPPORTED.includes(mime) || /\.(pdf|docx|txt)$/i.test(file.name);
    if (!allowed) { toast('Please choose a PDF, DOCX or TXT CV.', true); return; }
    input.dataset.gjrMobileHandled = '1';
    const textarea = input.closest('.input-card')?.querySelector('textarea') || document.querySelector('textarea');
    if (!textarea) { toast('CV editor is not ready. Please try again.', true); return; }
    toast('Reading your CV…');
    try {
      let text = '';
      if (mime === 'text/plain') text = await file.text();
      else if (mime === 'application/pdf') text = await parsePdf(file);
      else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') text = await parseDocx(file);
      if (!text.trim()) { toast('Reading the document securely with AI…'); text = await aiExtract(file, mime); }
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

  const findCvEditor = () => {
    const cards = [...document.querySelectorAll('.input-card')];
    const card = cards.find(el => /your\s*cv|cv\s*preparation|upload.*cv|resume/i.test(el.textContent || '') && el.querySelector('textarea'));
    if (card) return { card, textarea: card.querySelector('textarea') };
    const visibleTextareas = [...document.querySelectorAll('textarea')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleTextareas.length === 1 && /cv|resume/i.test(document.body.innerText || '')) {
      return { card: visibleTextareas[0].closest('.input-card') || visibleTextareas[0].parentElement, textarea: visibleTextareas[0] };
    }
    return null;
  };

  const ensureCvUploadControl = () => {
    const editor = findCvEditor();
    if (!editor?.card || !editor.textarea) return;
    const existing = [...editor.card.querySelectorAll('input[type="file"]')].find(isCvInput);
    if (existing) { patchCvInput(existing); return; }
    if (editor.card.querySelector('[data-gjr-cv-upload-fallback="1"]')) return;

    const wrap = document.createElement('div');
    wrap.dataset.gjrCvUploadFallback = '1';
    Object.assign(wrap.style, { display:'flex', alignItems:'center', gap:'10px', margin:'10px 0 12px', flexWrap:'wrap' });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Upload CV';
    button.setAttribute('aria-label', 'Upload CV');
    Object.assign(button.style, { border:'1px solid rgba(99,102,241,.35)', borderRadius:'10px', padding:'9px 13px', font:'700 13px/1 system-ui,sans-serif', cursor:'pointer' });
    const hint = document.createElement('span');
    hint.textContent = 'PDF, DOCX or TXT · max 5 MB';
    Object.assign(hint.style, { font:'500 12px/1.3 system-ui,sans-serif', opacity:'.7' });
    const input = document.createElement('input');
    input.type = 'file';
    input.dataset.gjrCvInput = '1';
    input.accept = CV_ACCEPT;
    input.setAttribute('aria-label', 'Choose CV file');
    Object.assign(input.style, { position:'absolute', width:'1px', height:'1px', opacity:'0', pointerEvents:'none' });
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) handle(input, file);
    });
    wrap.append(button, hint, input);
    editor.textarea.parentElement?.insertBefore(wrap, editor.textarea);
    patchCvInput(input);
  };

  const patchExistingInputs = () => document.querySelectorAll('input[type="file"]').forEach(patchCvInput);
  patchExistingInputs();
  ensureCvUploadControl();
  new MutationObserver(() => { patchExistingInputs(); ensureCvUploadControl(); }).observe(document.documentElement, { childList: true, subtree: true });

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
