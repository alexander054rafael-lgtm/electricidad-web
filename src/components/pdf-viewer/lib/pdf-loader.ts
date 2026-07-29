import type { PDFDocumentProxy } from 'pdfjs-dist';

let pdfjsLibInstance: typeof import('pdfjs-dist') | null = null;

/**
 * Safely load PDF.js client-side without SSR evaluation errors.
 * Configured to use local static worker matching installed pdfjs-dist version (6.2.108).
 * Eliminates external CDN dependencies and worker mismatch errors.
 */
export async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded on the browser client.');
  }

  if (!pdfjsLibInstance) {
    const pdfjs = await import('pdfjs-dist');
    // Set up GlobalWorkerOptions workerSrc using local static worker file
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    pdfjsLibInstance = pdfjs;
  }

  return pdfjsLibInstance;
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
