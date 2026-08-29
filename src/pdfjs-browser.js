// Browser-safe PDF.js facade. Do not load the 2MB PDF.js runtime during app boot.
// The native app only needs PDF.js after a user selects a PDF. Lazy-loading also
// prevents a PDF worker/module initialization failure from blanking the homepage.
let pdfLibPromise;
const loadPdfLib=()=>pdfLibPromise||(pdfLibPromise=import('pdfjs-dist/legacy/build/pdf.mjs'));

export const GlobalWorkerOptions={workerSrc:'/pdf.worker.mjs'};

export function getDocument(options={}){
  return {
    promise: loadPdfLib().then(lib=>{
      const pdfjs=lib.default&&lib.default.getDocument?lib.default:lib;
      pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
      return pdfjs.getDocument({...options,disableWorker:true}).promise;
    })
  };
}
