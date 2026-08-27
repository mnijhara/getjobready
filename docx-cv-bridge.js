import mammoth from 'mammoth';

const isDocx = file => /\.docx$/i.test(file?.name || '');

async function extractDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return String(result.value || '').trim();
}

document.addEventListener('change', async event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
  const file = input.files?.[0];
  if (!file || !isDocx(file)) return;

  // The native React handler accepts DOCX but cannot extract its text itself.
  // Fill the CV textarea after extraction and emit a real input event so
  // React's controlled state becomes the authoritative CV text.
  const card = input.closest('.input-card');
  const textarea = card?.querySelector('textarea');
  if (!textarea) return;

  textarea.dataset.docxExtracting = '1';
  try {
    const text = await extractDocx(file);
    if (!text) throw new Error('DOCX contained no readable text');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (error) {
    console.error('GetJobReady DOCX extraction failed', error);
    textarea.dispatchEvent(new CustomEvent('gjr-docx-error', { bubbles: true, detail: { message: 'We could not read this DOCX. Please paste the CV text or upload a PDF.' } }));
  } finally {
    delete textarea.dataset.docxExtracting;
  }
}, true);
