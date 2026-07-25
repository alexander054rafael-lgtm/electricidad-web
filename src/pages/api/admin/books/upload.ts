import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { createDriveResumableUploadSession, deleteDriveFile, verifyDriveManagedUpload } from '../../../../lib/google-drive/server';

export const prerender = false;

const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;
const sameOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get('origin');
  return !origin || origin === url.origin;
};
const safeStem = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'recurso';

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!sameOrigin(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  try {
    const body = await context.request.json() as { asset?: unknown; title?: unknown; originalName?: unknown; mimeType?: unknown; size?: unknown };
    const asset = body.asset === 'cover' || body.asset === 'pdf' ? body.asset : null;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
    const size = Number(body.size);
    if (!asset || !Number.isInteger(size) || size < 1) return json({ ok: false, error: 'Solicitud de subida inválida.' }, 422);
    const originalName = typeof body.originalName === 'string' ? body.originalName : '';
    if (asset === 'cover' && (!COVER_TYPES.has(mimeType) || size > 8 * 1024 * 1024)) return json({ ok: false, error: 'La portada debe ser JPG, PNG o WebP y pesar máximo 8 MB.' }, 422);
    if (asset === 'pdf' && (mimeType !== 'application/pdf' || !/\.pdf$/i.test(originalName) || size > 100 * 1024 * 1024)) return json({ ok: false, error: 'El documento debe ser PDF, usar extensión .pdf y pesar máximo 100 MB.' }, 422);
    const extension = asset === 'pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const name = `${safeStem(String(body.title ?? 'recurso'))}-${asset}-${crypto.randomUUID()}.${extension}`;
    return json({ ok: true, ...await createDriveResumableUploadSession(name, mimeType, size, asset) });
  } catch {
    return json({ ok: false, error: 'No se pudo iniciar la subida segura a Google Drive.' }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!sameOrigin(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  try {
    const body = await context.request.json() as { id?: unknown; uploadNonce?: unknown; asset?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    const uploadNonce = typeof body.uploadNonce === 'string' ? body.uploadNonce : '';
    const asset = body.asset === 'cover' || body.asset === 'pdf' ? body.asset : null;
    if (!DRIVE_ID_PATTERN.test(id) || !uploadNonce || !asset) return json({ ok: false, error: 'Archivo temporal inválido.' }, 422);
    await verifyDriveManagedUpload(id, uploadNonce, asset);
    await deleteDriveFile(id);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'No se pudo limpiar el archivo temporal.' }, 422);
  }
};
