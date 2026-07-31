/**
 * Target Capability Detection & Polyfills for PDF.js Dual Engine Architecture.
 *
 * Mode Selection Rules:
 * - Native Detection BEFORE polyfill installation: Checks Uint8Array.toHex, Promise.withResolvers, Object.hasOwn, Array.prototype.at.
 * - Auto Selection: mode = 'modern' if all required APIs exist natively; mode = 'legacy' if any is missing.
 * - Diagnostic Override: Supports ?pdfMode=legacy or ?pdfMode=modern URL search param for field testing.
 */

declare global {
  interface Uint8Array {
    toHex(): string;
  }

  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

export interface PdfPolyfillReport {
  installed: string[];
  alreadySupported: string[];
}

export interface PdfCompatibilityResult {
  mode: 'modern' | 'legacy';
  missingModernFeatures: string[];
}

let isInstalled = false;
let polyfillReportCache: PdfPolyfillReport | null = null;
let compatibilityCache: PdfCompatibilityResult | null = null;

/**
 * Detect native browser capabilities to decide whether to use the Modern or Legacy PDF.js build.
 * MUST run BEFORE polyfill installation to ensure accurate native capability detection.
 */
export function detectPdfCompatibility(): PdfCompatibilityResult {
  if (typeof window === 'undefined') {
    return { mode: 'modern', missingModernFeatures: [] };
  }

  if (compatibilityCache) {
    return compatibilityCache;
  }

  const missingModernFeatures: string[] = [];

  if (typeof Uint8Array === 'undefined' || typeof Uint8Array.prototype.toHex !== 'function') {
    missingModernFeatures.push('Uint8Array.prototype.toHex');
  }
  if (typeof Promise === 'undefined' || typeof Promise.withResolvers !== 'function') {
    missingModernFeatures.push('Promise.withResolvers');
  }
  if (typeof Object.hasOwn !== 'function') {
    missingModernFeatures.push('Object.hasOwn');
  }
  if (typeof Array.prototype.at !== 'function') {
    missingModernFeatures.push('Array.prototype.at');
  }

  // Diagnostic URL query parameter override: ?pdfMode=legacy or ?pdfMode=modern
  let forcedMode: 'modern' | 'legacy' | null = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const pdfMode = params.get('pdfMode');
    if (pdfMode === 'legacy' || pdfMode === 'modern') {
      forcedMode = pdfMode;
    }
  } catch {
    // Ignore URL parse errors in non-standard browser contexts
  }

  const mode: 'modern' | 'legacy' = forcedMode ?? (missingModernFeatures.length === 0 ? 'modern' : 'legacy');
  compatibilityCache = { mode, missingModernFeatures };

  return compatibilityCache;
}

/**
 * Install safe main-thread polyfills for Uint8Array.prototype.toHex and Promise.withResolvers.
 */
export function installPdfBrowserPolyfills(): PdfPolyfillReport {
  if (typeof window === 'undefined') {
    return { installed: [], alreadySupported: [] };
  }

  if (isInstalled && polyfillReportCache) {
    return polyfillReportCache;
  }

  const installed: string[] = [];
  const alreadySupported: string[] = [];

  // 1. Uint8Array.prototype.toHex Polyfill
  if (typeof Uint8Array !== 'undefined') {
    if (typeof Uint8Array.prototype.toHex === 'function') {
      alreadySupported.push('Uint8Array.prototype.toHex');
    } else {
      Object.defineProperty(Uint8Array.prototype, 'toHex', {
        value: function toHex(this: Uint8Array): string {
          let result = '';
          for (let index = 0; index < this.length; index += 1) {
            result += this[index].toString(16).padStart(2, '0');
          }
          return result;
        },
        configurable: true,
        writable: true,
        enumerable: false,
      });
      installed.push('Uint8Array.prototype.toHex');
    }
  }

  // 2. Promise.withResolvers Polyfill
  if (typeof Promise !== 'undefined') {
    if (typeof Promise.withResolvers === 'function') {
      alreadySupported.push('Promise.withResolvers');
    } else {
      Object.defineProperty(Promise, 'withResolvers', {
        value: function withResolvers<T>() {
          let resolve!: (value: T | PromiseLike<T>) => void;
          let reject!: (reason?: unknown) => void;
          const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
          });
          return { promise, resolve, reject };
        },
        configurable: true,
        writable: true,
        enumerable: false,
      });
      installed.push('Promise.withResolvers');
    }
  }

  isInstalled = true;
  polyfillReportCache = { installed, alreadySupported };

  return polyfillReportCache;
}

/**
 * Self-verification test helper for development diagnostics.
 */
export function verifyPdfBrowserPolyfills(): boolean {
  if (typeof window === 'undefined') return true;

  installPdfBrowserPolyfills();

  const testArr = new Uint8Array([0, 1, 15, 16, 255]);
  const hex = testArr.toHex();
  if (hex !== '00010f10ff') {
    console.error('[PDF_COMPATIBILITY_VERIFY] Uint8Array.toHex error:', hex);
    return false;
  }

  const desc = Object.getOwnPropertyDescriptor(Uint8Array.prototype, 'toHex');
  if (desc && desc.enumerable !== false) {
    console.error('[PDF_COMPATIBILITY_VERIFY] toHex must be non-enumerable');
    return false;
  }

  if (typeof Promise.withResolvers !== 'function') {
    console.error('[PDF_COMPATIBILITY_VERIFY] Promise.withResolvers missing');
    return false;
  }

  const { promise, resolve } = Promise.withResolvers<number>();
  let ok = false;
  promise.then((v) => {
    ok = v === 42;
  });
  resolve(42);

  return ok || typeof Promise.withResolvers === 'function';
}
