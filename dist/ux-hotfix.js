/* Production UX safety net for the student flow.
   1) Makes CV improvement work even when an older deployment lacks /api/improve-cv.
   2) Auto-submits a completed speech transcript so the interview feels conversational.
*/
(() => {
  const nativeFetch = window.fetch.bind(window);
  const improveDraft = (cv, suggestions) => {
    const lines = String(cv || '').split(/\r?\n/);
    const bullets = lines.map((line, index) => ({ line, index })).filter(x => /^\s*(?:[-•*]|\d+[.)])\s+/.test(x.line));
    const usable = Array.isArray(suggestions) ? suggestions.filter(Boolean).slice(0, bullets.length || 4) : [];
    if (!usable.length) return String(cv || '');
    if (bullets.length) {
      usable.forEach((suggestion, i) => {
        const target = bullets[i];
        const prefix = target.line.match(/^\s*(?:[-•*]|\d+[.)])\s+/)?.[0] || '• ';
        lines[target.index] = `${prefix}${suggestion}`;
      });
      return lines.join('\n');
    }
    return `${String(cv || '').trim()}\n\nAI-SUGGESTED IMPROVEMENTS\n${usable.map(x => `• ${x}`).join('\n')}`;
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.endsWith('/api/improve-cv')) return nativeFetch(input, init);
    try {
      const body = JSON.parse(init?.body || '{}');
      const analysisResponse = await nativeFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: String(body.cv || ''), jd: '', mode: 'general', career: 'job' })
      });
      const analysis = await analysisResponse.json();
      if (!analysisResponse.ok) return new Response(JSON.stringify({ error: analysis.error || 'AI improvement is temporarily unavailable.' }), { status: analysisResponse.status, headers: { 'Content-Type': 'application/json' } });
      const cv = improveDraft(body.cv, analysis.rewrittenBullets || body.review?.rewrittenBullets || []);
      return new Response(JSON.stringify({ cv }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'AI improvement is temporarily unavailable. Please retry in a moment.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  };

  const installVoiceUX = () => {
    document.querySelectorAll('.transcript-card .secondary').forEach(button => {
      button.setAttribute('aria-hidden', 'true');
      button.style.display = 'none';
    });
    document.querySelectorAll('.transcript-card').forEach(card => {
      const text = card.querySelector('p')?.textContent?.trim() || '';
      const button = card.querySelector('.secondary');
      if (button && text && text !== 'Your spoken answer will appear here.' && !card.dataset.autoSubmitted) {
        card.dataset.autoSubmitted = '1';
        setTimeout(() => button.click(), 650);
      }
      if (!text || text === 'Your spoken answer will appear here.') delete card.dataset.autoSubmitted;
    });
  };
  const style = document.createElement('style');
  style.textContent = '.transcript-card .secondary{display:none!important}.voice-card .primary{min-height:56px}';
  document.documentElement.appendChild(style);
  new MutationObserver(installVoiceUX).observe(document.body, { subtree: true, childList: true, characterData: true });
  setTimeout(installVoiceUX, 250);
})();
