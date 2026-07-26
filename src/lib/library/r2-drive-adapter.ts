// Browser-side adapter for the r2-drive backend.
// Calls Worker endpoints for Phase 4 upload flow.
// Uses Supabase session JWT for authentication.

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────

export type UploadKind = 'pdf' | 'cover';

export type InitUploadInput = {
  filename: string;
  mimeType: string;
  size: number;
  kind: UploadKind;
};

export type InitUploadResult = {
  ok: boolean;
  uploadId: string;
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  operationId: string;
  code?: string;
  error?: string;
};

export type CompleteUploadInput = {
  uploadId: string;
  objectKey: string;
};

export type CompleteUploadResult = {
  ok: boolean;
  status: string;
  uploadId: string;
  kind: UploadKind;
  size: number;
  sha256: string;
  operationId: string;
  code?: string;
  error?: string;
};

export type CleanupUploadInput = {
  uploadId: string;
  objectKey: string;
};

export type CleanupUploadResult = {
  ok: boolean;
  status: string;
  uploadId: string;
  operationId: string;
  code?: string;
  error?: string;
};

export type EditorialMetadata = {
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  category: string;
  resourceType: string;
  level: string | null;
  language: string;
  pages: number | null;
  tags: string[];
  topics: string[];
  badge: string | null;
  accent: string;
  allowDownload: boolean;
  isFeatured: boolean;
};

export type CompleteResourceInput = {
  idempotencyKey: string;
  pdfUploadId: string;
  pdfObjectKey: string;
  coverUploadId?: string;
  coverObjectKey?: string;
  metadata: EditorialMetadata;
  action: 'draft' | 'publish';
};

export type CompleteResourceResult = {
  ok: boolean;
  resourceId: string;
  slug: string;
  title: string;
  storageBackend: string;
  syncStatus: string;
  publicationPending: boolean;
  isPublished: boolean;
  message: string;
  operationId: string;
  code?: string;
  error?: string;
  idempotent?: boolean;
};

export type UploadState = {
  kind: UploadKind;
  uploadId: string;
  objectKey: string;
  status: 'pending' | 'uploading' | 'validated' | 'synced' | 'completed' | 'failed';
  file: File;
  sha256?: string;
};

export type ProgressCallback = (stage: string, percent: number) => void;

// ── Configuration ──────────────────────────────────────────────────

const WORKER_BASE_URL = import.meta.env.PUBLIC_LIBRARY_WORKER_URL ?? 'https://indutech-library-file-worker.alexander054rafael.workers.dev';

const generateIdempotencyKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ── JWT helper ─────────────────────────────────────────────────────

const getSupabaseSessionToken = async (
  supabase: SupabaseClient,
): Promise<{ token: string; error?: string }> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    return { token: '', error: error?.message ?? 'No hay sesión activa.' };
  }
  return { token: data.session.access_token };
};

// ── Main adapter ───────────────────────────────────────────────────

export const createR2DriveAdapter = (supabase: SupabaseClient) => {
  const getToken = async (): Promise<string> => {
    const { token } = await getSupabaseSessionToken(supabase);
    return token;
  };

  const initUpload = async (
    input: InitUploadInput,
    abortSignal?: AbortSignal,
  ): Promise<InitUploadResult> => {
    const token = await getToken();
    if (!token) throw new Error('No hay sesión activa. Inicia sesión como administrador.');

    const response = await fetch(`${WORKER_BASE_URL}/v1/admin/library/uploads/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: abortSignal,
    });
    return await response.json() as InitUploadResult;
  };

  const uploadToR2 = async (
    file: File,
    uploadUrl: string,
    headers: Record<string, string>,
    onProgress?: (percent: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Subida fallida: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
      xhr.onabort = () => reject(new DOMException('Subida cancelada.', 'AbortError'));

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.send(file);
    });
  };

  const completeUpload = async (
    input: CompleteUploadInput,
    abortSignal?: AbortSignal,
  ): Promise<CompleteUploadResult> => {
    const token = await getToken();
    if (!token) throw new Error('No hay sesión activa.');

    const response = await fetch(`${WORKER_BASE_URL}/v1/admin/library/uploads/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: abortSignal,
    });
    return await response.json() as CompleteUploadResult;
  };

  const completeResource = async (
    input: CompleteResourceInput,
    abortSignal?: AbortSignal,
  ): Promise<CompleteResourceResult> => {
    const token = await getToken();
    if (!token) throw new Error('No hay sesión activa.');

    const response = await fetch(`${WORKER_BASE_URL}/v1/admin/library/resources/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: abortSignal,
    });
    return await response.json() as CompleteResourceResult;
  };

  const cleanup = async (
    input: CleanupUploadInput,
    abortSignal?: AbortSignal,
  ): Promise<CleanupUploadResult> => {
    const token = await getToken();
    if (!token) throw new Error('No hay sesión activa.');

    const response = await fetch(`${WORKER_BASE_URL}/v1/admin/library/uploads/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: abortSignal,
    });
    return await response.json() as CleanupUploadResult;
  };

  const uploadAndSave = async (
    files: { pdf: File; cover?: File },
    metadata: EditorialMetadata,
    action: 'draft' | 'publish',
    onProgress?: ProgressCallback,
    abortSignal?: AbortSignal,
  ): Promise<{ resourceId: string; slug: string; title: string; message: string }> => {
    const idempotencyKey = generateIdempotencyKey();
    const uploads: UploadState[] = [];

    // Step 1: Initiate PDF upload
    onProgress?.('Preparando subida del PDF…', 5);
    const pdfInit = await initUpload(
      {
        filename: files.pdf.name,
        mimeType: files.pdf.type || 'application/pdf',
        size: files.pdf.size,
        kind: 'pdf',
      },
      abortSignal,
    );
    if (!pdfInit.ok) throw new Error(pdfInit.error ?? 'No se pudo iniciar la subida del PDF.');
    uploads.push({ kind: 'pdf', uploadId: pdfInit.uploadId, objectKey: pdfInit.objectKey, status: 'pending', file: files.pdf });

    // Step 2: Upload PDF to R2
    onProgress?.('Subiendo PDF a R2…', 15);
    await uploadToR2(files.pdf, pdfInit.uploadUrl, pdfInit.headers, (pct) => {
      onProgress?.('Subiendo PDF a R2…', 15 + Math.round(pct * 0.3));
    }, abortSignal);
    const pdfState = uploads.find((u) => u.kind === 'pdf')!;
    pdfState.status = 'uploading';

    // Step 3: Validate PDF
    onProgress?.('Validando PDF…', 50);
    const pdfComplete = await completeUpload(
      { uploadId: pdfInit.uploadId, objectKey: pdfInit.objectKey },
      abortSignal,
    );
    if (!pdfComplete.ok) throw new Error(pdfComplete.error ?? 'La validación del PDF falló.');
    pdfState.status = 'validated';
    pdfState.sha256 = pdfComplete.sha256;

    // Step 1-3 for cover (optional)
    let coverState: UploadState | undefined;
    if (files.cover) {
      onProgress?.('Preparando subida de la portada…', 55);
      const coverInit = await initUpload(
        {
          filename: files.cover.name,
          mimeType: files.cover.type || 'image/jpeg',
          size: files.cover.size,
          kind: 'cover',
        },
        abortSignal,
      );
      if (!coverInit.ok) throw new Error(coverInit.error ?? 'No se pudo iniciar la subida de la portada.');
      uploads.push({ kind: 'cover', uploadId: coverInit.uploadId, objectKey: coverInit.objectKey, status: 'pending', file: files.cover });
      coverState = uploads[uploads.length - 1];

      onProgress?.('Subiendo portada a R2…', 60);
      await uploadToR2(files.cover, coverInit.uploadUrl, coverInit.headers, (pct) => {
        onProgress?.('Subiendo portada a R2…', 60 + Math.round(pct * 0.1));
      }, abortSignal);
      coverState.status = 'uploading';

      onProgress?.('Validando portada…', 72);
      const coverComplete = await completeUpload(
        { uploadId: coverInit.uploadId, objectKey: coverInit.objectKey },
        abortSignal,
      );
      if (!coverComplete.ok) throw new Error(coverComplete.error ?? 'La validación de la portada falló.');
      coverState.status = 'validated';
      coverState.sha256 = coverComplete.sha256;
    }

    // Step 4: Complete resource (sync to Drive + insert into Supabase)
    onProgress?.('Copiando a Google Drive…', 78);
    const resourceResult = await completeResource(
      {
        idempotencyKey,
        pdfUploadId: pdfInit.uploadId,
        pdfObjectKey: pdfInit.objectKey,
        coverUploadId: coverState?.uploadId,
        coverObjectKey: coverState?.objectKey,
        metadata,
        action,
      },
      abortSignal,
    );
    if (!resourceResult.ok) throw new Error(resourceResult.error ?? 'No se pudo guardar el recurso.');

    // Step 5: Cleanup temporary uploads (best-effort, after successful insert)
    onProgress?.('Limpiando archivos temporales…', 95);
    await Promise.allSettled(
      uploads.map((u) => cleanup({ uploadId: u.uploadId, objectKey: u.objectKey }).catch(() => {})),
    );

    onProgress?.('Completado.', 100);
    return {
      resourceId: resourceResult.resourceId,
      slug: resourceResult.slug,
      title: resourceResult.title,
      message: resourceResult.message,
    };
  };

  return {
    initUpload,
    uploadToR2,
    completeUpload,
    completeResource,
    cleanup,
    uploadAndSave,
  };
};
