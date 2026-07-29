import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const targetDir = path.join(projectRoot, 'public');
const targetPath = path.join(targetDir, 'pdf.worker.min.mjs');

function syncPdfWorker() {
  try {
    if (!fs.existsSync(sourcePath)) {
      console.error(`[pdf-worker-sync] ERROR: No se encontró el worker original en: ${sourcePath}`);
      console.error('[pdf-worker-sync] Asegúrate de ejecutar "npm install" primero.');
      process.exit(1);
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(sourcePath, targetPath);

    // Read package.json to display exact version
    const pkgPath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'package.json');
    let version = '6.2.108';
    if (fs.existsSync(pkgPath)) {
      const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = pkgData.version || version;
    }

    console.log(`[pdf-worker-sync] ✓ PDF.js worker v${version} sincronizado exitosamente en /public/pdf.worker.min.mjs`);
  } catch (err) {
    console.error(`[pdf-worker-sync] ERROR al copiar el worker: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

syncPdfWorker();
