import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const modernSourcePath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const legacySourcePath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');

const targetDir = path.join(projectRoot, 'public');
const modernTargetPath = path.join(targetDir, 'pdf.worker.min.mjs');
const legacyOriginalTargetPath = path.join(targetDir, 'pdf.worker.legacy.original.min.mjs');
const legacyCompatV1TargetPath = path.join(targetDir, 'pdf.worker.legacy.compat.v1.mjs');

const polyfillHeader = `const pdfLegacyWorkerCompatibility = (() => {
  if (
    typeof Uint8Array !== 'undefined' &&
    typeof Uint8Array.prototype.toHex !== 'function'
  ) {
    Object.defineProperty(Uint8Array.prototype, 'toHex', {
      value: function toHex() {
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
  }

  if (typeof Promise.withResolvers !== 'function') {
    Object.defineProperty(Promise, 'withResolvers', {
      value: function withResolvers() {
        let resolve;
        let reject;

        const promise = new Promise((resolvePromise, rejectPromise) => {
          resolve = resolvePromise;
          reject = rejectPromise;
        });

        return { promise, resolve, reject };
      },
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }

  return 'legacy-worker-polyfill-v1';
})();
`;

function syncPdfWorkers() {
  try {
    if (!fs.existsSync(modernSourcePath)) {
      console.error(`[pdf-worker-sync] ERROR: No se encontró el worker moderno en: ${modernSourcePath}`);
      process.exit(1);
    }
    if (!fs.existsSync(legacySourcePath)) {
      console.error(`[pdf-worker-sync] ERROR: No se encontró el worker legacy en: ${legacySourcePath}`);
      process.exit(1);
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Copy modern worker to public/pdf.worker.min.mjs without modifications
    fs.copyFileSync(modernSourcePath, modernTargetPath);

    // 2. Copy legacy original worker to public/pdf.worker.legacy.original.min.mjs
    fs.copyFileSync(legacySourcePath, legacyOriginalTargetPath);

    // 3. Create public/pdf.worker.legacy.compat.v1.mjs by physically prepending the polyfill header
    const originalLegacyContent = fs.readFileSync(legacySourcePath, 'utf8');
    const compatWorkerContent = polyfillHeader + originalLegacyContent;
    fs.writeFileSync(legacyCompatV1TargetPath, compatWorkerContent, 'utf8');

    // Read package.json to verify exact version
    const pkgPath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'package.json');
    let version = '6.2.108';
    if (fs.existsSync(pkgPath)) {
      const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = pkgData.version || version;
    }

    console.log(`[pdf-worker-sync] ✓ PDF.js worker moderno (v${version}) sincronizado en /public/pdf.worker.min.mjs`);
    console.log(`[pdf-worker-sync] ✓ PDF.js worker legacy original (v${version}) sincronizado en /public/pdf.worker.legacy.original.min.mjs`);
    console.log(`[pdf-worker-sync] ✓ PDF.js worker legacy compatible v1 (v${version}) generado en /public/pdf.worker.legacy.compat.v1.mjs`);
  } catch (err) {
    console.error(`[pdf-worker-sync] ERROR al copiar los workers: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

syncPdfWorkers();
