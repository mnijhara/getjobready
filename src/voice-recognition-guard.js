// SpeechRecognition guard for Chrome/Android.
// The native API's SpeechRecognitionEvent.results collection is cumulative.
// The interview UI expects a current transcript, so expose one canonical result
// per event and prevent historical final results from being appended repeatedly.

const installVoiceRecognitionGuard = () => {
  if (typeof window === 'undefined') return;
  const Native = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Native || Native.__gjrNormalized) return;

  const Wrapped = function (...args) {
    const instance = new Native(...args);
    let resultHandler = null;
    let transcript = '';

    Object.defineProperty(instance, 'onresult', {
      configurable: true,
      enumerable: true,
      get: () => resultHandler,
      set: handler => {
        resultHandler = typeof handler === 'function' ? handler : null;
      }
    });

    instance.addEventListener?.('result', event => {
      if (!resultHandler) return;

      const finalParts = [];
      const interimParts = [];
      const results = event?.results || [];

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        const text = String(result?.[0]?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) finalParts.push(text);
        else interimParts.push(text);
      }

      const next = [...finalParts, ...interimParts].join(' ').replace(/\s+/g, ' ').trim();
      if (!next) return;
      transcript = next;

      // Present the application with exactly one canonical cumulative result.
      // This preserves the UI's existing onresult implementation while making
      // repeated/interim browser events idempotent.
      const synthetic = {
        resultIndex: 0,
        results: [{
          0: { transcript, confidence: Number(results[results.length - 1]?.[0]?.confidence || 1) },
          length: 1,
          isFinal: finalParts.length > 0 && interimParts.length === 0,
          item: index => results[index]?.[0]
        }]
      };

      resultHandler(synthetic);
    });

    return instance;
  };

  // Preserve constructor/static behaviour expected by browsers and tests.
  Object.setPrototypeOf(Wrapped, Native);
  Wrapped.prototype = Native.prototype;
  Wrapped.__gjrNormalized = true;

  if (window.SpeechRecognition) window.SpeechRecognition = Wrapped;
  if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = Wrapped;
};

installVoiceRecognitionGuard();

export { installVoiceRecognitionGuard };
