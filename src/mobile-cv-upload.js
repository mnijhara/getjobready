(() => {
  const WORKER = 'https://getjobready-ai-proxy.mnijhara.workers.dev';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  if (!isMobile) return;

  const clean = (s) => String(s || '').replace(/\r\n/g, '\n').split('\n').map(x => x.trim()).filter(Boolean).join('\n');
  const setReactTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const toast = (msg, bad = false) => {
    let el = document.getElementById('gjr-mobile-upload-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gjr-mobile-upload-status';
      Object.assign(el.style, { position:'fixed', left:'16px', right:'16px', bottom:'18px', zIndex:99999, padding:'13px 15px', borderRadius:'14px', background:bad?'#7f1d1d':'#171e31', color:'#fff', font:'700 13px/1.4 system-ui,sans-serif', boxShadow:'0 12px 35px rgba(0,0,0,.25)', textAlign:'center' });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 4500);
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
      out = clean(out);
      if (out) return out;
    } catch (e) {
      console.warn('Mobile PDF.js extraction failed; using document AI fallback.', e);
    }
    return '';
  }

  async function parseDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const out = clean(result.value);
      if (out) return out;
    } catch (e) {
      console.warn('Mobile DOCX extraction failed; using document AI fallback.', e);
    }
    return '';
  }

  async function aiExtract(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    const data = btoa(binary);
    const mime = file.type || (/.pdf$/i.test(file.name) ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const prompt = `Extract the student's CV from this uploaded document. Return ONLY the readable CV text, preserving names, headings, dates, employers, education, skills, projects, achievements and bullet content. Do not invent, summarize, improve, or omit factual information. If the document is scanned/image-based, read the visible text with visual document understanding.`;
    const r = await fetch(`${WORKER}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }], model: 'gemini-3.7-flash', generationConfig: { maxOutputTokens: 7000 } })
    });
    if (!r.ok) throw new Error(`AI extraction failed (${r.status})`);
    const raw = await r.text();
    let obj;
    try { obj = JSON.parse(raw); } catch { obj = null; }
    const text = obj?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || obj?.text || obj?.output || obj?.response || raw;
    const out = clean(String(text).replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/i, ''));
    if (!out) throw new Error('No CV text returned');
    return out;
  }

  async function handle(input, file) {
    if (!file) return;
    const isCvInput = input.accept?.includes('.docx');
    if (!isCvInput) return;
    const allowed = /\.(pdf|docx|txt)$/i.test(file.name) || file.type === 'application/pdf' || file.type === 'text/plain' || file.type?.includes('wordprocessingml');
    if (!allowed) return;

    input.dataset.gjrMobileHandled = '1';
    const textarea = document.querySelector('#cvText') || document.querySelector('.input-card textarea') || document.querySelector('textarea');
    if (!textarea) return;
    toast('Reading your CV…');
    try {
      let text = '';
      if (/\.txt$/i.test(file.name) || file.type === 'text/plain') text = await file.text();
      else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await parsePdf(file);
      else if (/\.docx$/i.test(file.name) || file.type?.includes('wordprocessingml')) text = await parseDocx(file);
      if (!text.trim() && (/\.pdf$/i.test(file.name) || /\.docx$/i.test(file.name) || file.type === 'application/pdf' || file.type?.includes('wordprocessingml'))) {
        toast('Reading the document with AI…');
        text = await aiExtract(file);
      }
      text = clean(text);
      if (!text) throw new Error('No readable CV content was found.');
      setReactTextarea(textarea, text);
      if (typeof window.__gjrSetCv === 'function') {
        window.__gjrSetCv(text, file);
      }
      try { sessionStorage.setItem('gjr_cv_text', text); } catch {}
      const label = input.closest('label');
      const nameEl = label?.querySelector('b');
      const statusEl = label?.querySelector('span');
      if (nameEl) nameEl.textContent = file.name;
      if (statusEl) statusEl.textContent = 'CV loaded · ready for review';
      toast('CV uploaded successfully. You can review it now.');
    } catch (e) {
      console.error('Mobile CV upload failed', e);
      toast('We could not read this CV. Please retry or paste the CV text below.', true);
    }
  }

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !input.accept?.includes('.docx')) return;
    const file = input.files?.[0];
    if (!file) return;
    const allowed = /\.(pdf|docx|txt)$/i.test(file.name) || file.type === 'application/pdf' || file.type === 'text/plain' || file.type?.includes('wordprocessingml');
    if (!allowed) return;

    const textarea = document.querySelector('#cvText') || document.querySelector('.input-card textarea') || document.querySelector('textarea');
    if (!textarea) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    handle(input, file);
  }, true);
})();
