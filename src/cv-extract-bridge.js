(() => {
  const WORKER = 'https://getjobready-ai-proxy.mnijhara.workers.dev';
  if (window.__gjrCvExtractBridgeInstalled) return;
  window.__gjrCvExtractBridgeInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  const decode = async (response) => {
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    const modelText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || data?.text || data?.output || '';
    return String(modelText || '').trim();
  };
  const inferMime = (mime, data) => {
    const normalized = String(mime || '').toLowerCase().split(';')[0].trim();
    if (normalized === 'application/pdf' || normalized === 'text/plain' || normalized === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return normalized;
    try {
      const prefix = atob(String(data || '').slice(0, 16));
      if (prefix.startsWith('%PDF-')) return 'application/pdf';
      if (prefix.startsWith('PK')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } catch {}
    return normalized || 'application/pdf';
  };
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (url === '/api/extract-cv' && (init.method || 'GET').toUpperCase() === 'POST') {
      try {
        const serverResponse = await nativeFetch(input, init);
        const contentType = serverResponse.headers.get('content-type') || '';
        if (contentType.toLowerCase().includes('application/json')) return serverResponse;
        if (serverResponse.status >= 400 && serverResponse.status < 500 && serverResponse.status !== 404 && serverResponse.status !== 405) return serverResponse;
      } catch (e) {
        console.warn('Same-origin CV extraction unavailable; trying proxy fallback:', e);
      }

      try {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : (init.body || {});
        const data = String(body.data || '');
        const mime = inferMime(body.mime, data);
        if (!data) return new Response(JSON.stringify({ error: 'CV file data is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        const prompt = `Extract the complete readable text from this student's uploaded CV document. Preserve names, headings, dates, employers, projects, skills and bullet wording as faithfully as possible. Do not summarise, rewrite, invent or omit content. Return ONLY the extracted CV text, with sensible line breaks. If the document is image/scanned based, use visual understanding to read it. Do not return JSON or markdown fences.`;
        const r = await nativeFetch(`${WORKER}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: 'gemini-3.7-flash',
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }],
            generationConfig: { responseMimeType: 'text/plain', maxOutputTokens: 7000 },
            json: false
          })
        });
        if (!r.ok) {
          const err = await r.text().catch(() => '');
          return new Response(JSON.stringify({ error: `CV extraction service ${r.status}: ${err.slice(0, 240)}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }
        const extracted = await decode(r);
        if (!extracted) return new Response(JSON.stringify({ error: 'The CV extraction service returned no text.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ text: extracted }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: `CV extraction bridge failed: ${String(e?.message || e)}` }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return nativeFetch(input, init);
  };
})();
