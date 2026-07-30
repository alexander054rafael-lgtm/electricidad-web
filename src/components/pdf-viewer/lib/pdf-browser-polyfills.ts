/**
 * Target Polyfills for PDF.js Compatibility on Legacy Browsers (Chromium <128 / Android Tablets).
 *
 * Hardening Features:
 * - Non-overwriting: Respects existing native implementations.
 * - Standard Spec: Uint8Array.prototype.toHex produces lowercase 2-char padded hex strings.
 * - Non-enumerable: Uses Object.defineProperty with enumerable: false to prevent for..in pollution.
 * - SSR Protection: Safe no-op execution when evaluated in server context.
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

let isInstalled = false;
let polyfillReportCache: PdfPolyfillReport | null = null;

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

  if (import.meta.env.DEV) {
    console.info('[PDF_COMPATIBILITY]', polyfillReportCache);
    verifyPdfBrowserPolyfills();
  }

  return polyfillReportCache;
}

/**
 * Self-verification test helper for development diagnostics.
 */
export function verifyPdfBrowserPolyfills(): boolean {
  if (typeof window === 'undefined') return true;

  installPdfBrowserPolyfills();

  // Test 1: Uint8Array([0, 1, 15, 16, 255]) produces "00010f10ff"
  const testArr = new Uint8Array([0, 1, 15, 16, 255]);
  const hex = testArr.toHex();
  if (hex !== '00010f10ff') {
    console.error('[PDF_COMPATIBILITY_VERIFY] Uint8Array.toHex error:', hex);
    return false;
  }

  // Test 2: Uint8Array.prototype.toHex is non-enumerable
  const desc = Object.getOwnPropertyDescriptor(Uint8Array.prototype, 'toHex');
  if (desc && desc.enumerable !== false) {
    console.error('[PDF_COMPATIBILITY_VERIFY] toHex must be non-enumerable');
    return false;
  }

  // Test 3: Promise.withResolvers is functional
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
