import { requireAdmin } from '../auth/admin';
import { createObjectKey, createPresignedPutUrl, deleteUploadOperation, getManifest, saveManifest, sha256, type UploadManifest } from '../services/r2-upload';
import { hasValidSignature, isUploadId, parseUploadDescriptor } from '../security/validation';
import { json } from '../security/cors';
import type { WorkerContext } from '../types/env';

const parseJson = async (request: Request) => {
  try { return await request.json() as Record<string, unknown>; } catch { return undefined; }
};
export const uploadInit = async ({ request, env, operationId }: WorkerContext, origin?: string) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, code: auth.code, error: auth.error, operationId }, auth.status, origin);
  const descriptor = parseUploadDescriptor(await parseJson(request), { pdf: env.MAX_PDF_BYTES, cover: env.MAX_COVER_BYTES });
  if (!descriptor) return json({ ok: false, code: 'invalid_upload_descriptor', error: 'El archivo no cumple los requisitos permitidos.', operationId }, 422, origin);
  const uploadId = crypto.randomUUID();
  const objectKey = createObjectKey(uploadId, descriptor);
  try {
    const signed = await createPresignedPutUrl(env, objectKey, descriptor.mimeType);
    const manifest: UploadManifest = { ...descriptor, uploadId, objectKey, ownerId: auth.userId, createdAt: new Date().toISOString(), expiresAt: signed.expiresAt, status: 'pending' };
    await saveManifest(env, manifest);
    return json({ ok: true, uploadId, objectKey, uploadUrl: signed.uploadUrl, headers: signed.headers, expiresAt: signed.expiresAt, operationId }, 201, origin);
  } catch {
    return json({ ok: false, code: 'r2_presign_unavailable', error: 'No se pudo preparar la subida temporal a R2.', operationId }, 503, origin);
  }
};

type OwnedManifest = { userId: string; manifest: UploadManifest } | { denied: Response };

const getOwnedManifest = async (request: Request, context: WorkerContext, origin?: string): Promise<OwnedManifest> => {
  const auth = await requireAdmin(request, context.env);
  if (!auth.ok) return { denied: json({ ok: false, code: auth.code, error: auth.error, operationId: context.operationId }, auth.status, origin) };
  const body = await parseJson(request);
  const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
  const objectKey = typeof body?.objectKey === 'string' ? body.objectKey : '';
  if (!isUploadId(uploadId)) return { denied: json({ ok: false, code: 'invalid_upload_operation', error: 'Operación de subida no válida.', operationId: context.operationId }, 422, origin) };
  const manifest = await getManifest(context.env, uploadId);
  if (!manifest || manifest.objectKey !== objectKey || manifest.ownerId !== auth.userId) return { denied: json({ ok: false, code: 'upload_operation_not_found', error: 'La operación temporal no está disponible.', operationId: context.operationId }, 404, origin) };
  return { userId: auth.userId, manifest };
};

export const uploadComplete = async (context: WorkerContext, origin?: string) => {
  const owned = await getOwnedManifest(context.request, context, origin);
  if ('denied' in owned) return owned.denied;
  const { manifest } = owned;
  try {
    const object = await context.env.LIBRARY_CACHE.get(manifest.objectKey);
    if (!object) return json({ ok: false, code: 'upload_object_not_found', error: 'El archivo temporal no se encontró en R2.', operationId: context.operationId }, 404, origin);
    if (object.size !== manifest.size || object.httpMetadata?.contentType !== manifest.mimeType) return json({ ok: false, code: 'upload_metadata_invalid', error: 'El archivo temporal no coincide con la operación autorizada.', operationId: context.operationId }, 422, origin);
    const bytes = await object.arrayBuffer();
    if (!hasValidSignature(new Uint8Array(bytes), manifest.kind, manifest.mimeType)) return json({ ok: false, code: 'upload_signature_invalid', error: 'La firma binaria del archivo no es válida.', operationId: context.operationId }, 422, origin);
    const hash = await sha256(bytes);
    await saveManifest(context.env, { ...manifest, status: 'validated', sha256: hash });
    return json({ ok: true, status: 'validated', uploadId: manifest.uploadId, kind: manifest.kind, size: manifest.size, sha256: hash, operationId: context.operationId }, 200, origin);
  } catch {
    return json({ ok: false, code: 'upload_validation_failed', error: 'No se pudo validar el archivo temporal.', operationId: context.operationId }, 502, origin);
  }
};

export const uploadCleanup = async (context: WorkerContext, origin?: string) => {
  const owned = await getOwnedManifest(context.request, context, origin);
  if ('denied' in owned) return owned.denied;
  try {
    await deleteUploadOperation(context.env, owned.manifest);
    return json({ ok: true, status: 'cleaned', uploadId: owned.manifest.uploadId, operationId: context.operationId }, 200, origin);
  } catch {
    return json({ ok: false, code: 'upload_cleanup_failed', error: 'No se pudo limpiar la subida temporal.', operationId: context.operationId }, 502, origin);
  }
};
