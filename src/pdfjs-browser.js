// Browser-safe PDF.js facade. Do not load the 2MB PDF.js runtime during app boot.
// The native app only needs PDF.js after a user selects a PDF. Lazy-loading also
// prevents a PDF worker/module initialization failure from blanking the homepage.
let pdfLibPromise;
const loadPdfLib=()=>pdfLibPromise||(pdfLibPromise=Promise.all([
  import('pdfjs-dist/legacy/build/pdf.mjs'),
  import('pdfjs-dist/legacy/build/pdf.worker.mjs').catch(()=>null)
]));

export const GlobalWorkerOptions={workerSrc:'/pdf.worker.js'};

export function getDocument(options={}){
  return {
    promise: loadPdfLib().then(([lib, worker])=>{
      const pdfjs=lib.default&&lib.default.getDocument?lib.default:lib;
      if (worker && typeof window !== 'undefined') {
        window.pdfjsWorker = worker;
      }
      pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.js';
      return pdfjs.getDocument({...options,disableWorker:true}).promise;
    })
  };
}
