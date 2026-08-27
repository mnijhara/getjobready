(() => {
  const AI_PROXY = 'https://getjobready-ai-proxy.mnijhara.workers.dev/';
  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const normalizeInit = init => {
    if (!init || typeof init.body !== 'string') return init;
    try {
      const body = JSON.parse(init.body);
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      const parts = body?.contents?.[0]?.parts;
      if (prompt && Array.isArray(parts) && parts.length && parts[0]?.text === prompt) {
        body.contents[0].parts = parts.slice(1);
        return { ...init, body: JSON.stringify(body) };
      }
    } catch {
      // Preserve non-JSON request bodies unchanged.
    }
    return init;
  };

  // Some legacy/native UI code calls the Cloudflare AI proxy directly. Keep that
  // path resilient to transient throttling or edge failures without touching
  // credentials or changing the response contract. Also remove the duplicated
  // prompt that older callers may send in both `prompt` and `contents.parts`.
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!url.startsWith(AI_PROXY)) return nativeFetch(input, init);
    const requestInit = normalizeInit(init);

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await nativeFetch(input, requestInit);
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await sleep(250 * attempt + Math.floor(Math.random() * 150));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await sleep(200 * attempt + Math.floor(Math.random() * 150));
      }
    }
    throw lastError || new Error('AI proxy request failed');
  };
})();
