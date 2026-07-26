import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { ensureLibraryDriveFolders } from '../../../../lib/google-drive/server';
import { LIBRARY_FILE_LIMITS } from '../../../../lib/library/validation';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  try {
    const folders = await ensureLibraryDriveFolders();
    return json({
      ok: true,
      pdfFolderId: folders.pdfs.id,
      coverFolderId: folders.covers.id,
      maxPdfBytes: LIBRARY_FILE_LIMITS.pdf,
      maxCoverBytes: LIBRARY_FILE_LIMITS.cover,
      allowedPdfTypes: ['application/pdf'],
      allowedCoverTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  } catch {
    return json({ ok: false, error: 'No se pudo preparar Google Drive para la subida.' }, 502);
  }
};
