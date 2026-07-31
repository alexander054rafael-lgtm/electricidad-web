import type { PDFDocumentProxy } from 'pdfjs-dist';
import { detectPdfCompatibility, installPdfBrowserPolyfills } from './pdf-browser-polyfills';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Safely load PDF.js client-side with dual engine support (Modern vs Legacy).
 *
 * Sequence:
 * 1. Native Capability Detection (BEFORE polyfill installation).
 * 2. Auxiliary Main-Thread Polyfills.
 * 3. Dynamic import of target PDF.js build (modern vs legacy).
 * 4. Configuration of corresponding static Web Worker (/pdf.worker.min.mjs vs /pdf.worker.legacy.min.mjs).
 */
export async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded on the browser client.');
  }

  if (pdfjsPromise) {
    return pdfjsPromise;
  }

  pdfjsPromise = (async () => {
    // 1. Detect native capabilities BEFORE installing polyfills
    const compatibility = detectPdfCompatibility();

    // 2. Install main-thread polyfills
    installPdfBrowserPolyfills();

    // 3. Load target build & worker matching compatibility mode
    let pdfjs: typeof import('pdfjs-dist');
    let workerSrc: string;

    if (compatibility.mode === 'legacy') {
      // Import legacy build for older Chromium / Android tablets
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      workerSrc = '/pdf.worker.legacy.compat.v1.mjs';
    } else {
      // Import modern ES2024 build
      pdfjs = await import('pdfjs-dist');
      workerSrc = '/pdf.worker.min.mjs';
    }

    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }

    // 4. Diagnostic Logging (DEV mode or ?pdfDebug=1)
    let isDebugUrl = false;
    try {
      isDebugUrl = new URLSearchParams(window.location.search).get('pdfDebug') === '1';
    } catch {
      // Ignore
    }

    if (import.meta.env.DEV || isDebugUrl) {
      console.info('[PDF_COMPATIBILITY]', {
        selectedMode: compatibility.mode,
        missingModernFeatures: compatibility.missingModernFeatures,
        workerSrc,
        nativeToHex: typeof Uint8Array.prototype.toHex === 'function',
        nativePromiseWithResolvers: typeof Promise.withResolvers === 'function',
      });
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
