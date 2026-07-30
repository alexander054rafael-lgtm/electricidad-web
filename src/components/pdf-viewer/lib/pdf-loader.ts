import type { PDFDocumentProxy } from 'pdfjs-dist';
import { installPdfBrowserPolyfills } from './pdf-browser-polyfills';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Safely load PDF.js client-side without SSR evaluation errors.
 * Configured to use local static worker matching installed pdfjs-dist version (6.2.108).
 * Installs target browser polyfills (Uint8Array.toHex, Promise.withResolvers) BEFORE PDF.js evaluation.
 */
export async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded on the browser client.');
  }

  if (pdfjsPromise) {
    return pdfjsPromise;
  }

  pdfjsPromise = (async () => {
    // 1. Install browser polyfills BEFORE importing PDF.js module
    installPdfBrowserPolyfills();

    // 2. Dynamically import PDF.js
    const pdfjs = await import('pdfjs-dist');

    // 3. Set up GlobalWorkerOptions workerSrc using local static worker file
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    return pdfjs;
  })();

  return pdfjsPromise;
}

/**
 * Load PDF document proxy safely from URL.
 */
export async function loadPdfDocument(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjsLib();
  const loadingTask = pdfjs.getDocument({
    url,
    withCredentials: false,
    cMapPacked: true,
  });

  return await loadingTask.promise;
}
