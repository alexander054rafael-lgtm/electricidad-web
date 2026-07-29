/**
 * Public PDF Streaming Endpoint for InduTech Academy Library.
 *
 * Architecture & Hardening Features:
 * - Autonomous Server Validations: Validates UUID format, resource existence,
 *   and publication status (is_published) independently of client state.
 * - Anti-Tampering: Rejects any client-supplied pdfUrl query/body parameters.
 * - Storage Provider Isolation: Never exposes private storage URLs or Drive File IDs to client.
 * - Security Hardening (404 on Unpublished): Returns 404 Not Found for unpublished
 *   draft resources to prevent resource enumeration and information disclosure.
 * - Strict Admin Fallback: Fallback to createSupabaseAdminClient triggers ONLY for RLS permission
 *   error 42501, maintaining .eq('is_published', true) and minimal column selection.
 * - AbortSignal & Stream Cancellation: Passes context.request.signal to streamDriveFile so Google Drive
 *   streams are aborted immediately when client disconnects.
 * - Standardized Error Contracts: Returns structured JSON errors with stable codes and requestId.
 * - HTTP Range Support: Supports 206 Partial Content range requests (Accept-Ranges: bytes, Content-Range).
 */

import type { APIRoute } from 'astro';
import { streamDriveFile } from '../../../../../lib/google-drive/server';
import { getOrCreateRequestId, logger } from '../../../../../lib/logger';
import { createSupabaseAdminClient, shouldUseAdminFallback } from '../../../../../lib/supabase/server';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_SELECT_COLUMNS = 'id,title,author,drive_file_id,drive_file_name,drive_mime_type,storage_backend,allow_download,is_published';

export type PdfErrorCode =
  | 'INVALID_RESOURCE_ID'
  | 'PDF_NOT_FOUND'
  | 'PARAM_NOT_ALLOWED'
  | 'PDF_SOURCE_UNAVAILABLE'
  | 'STORAGE_TEMPORARILY_UNAVAILABLE'
  | 'INTERNAL_PDF_ERROR';

const jsonError = (code: PdfErrorCode, message: string, status: number, requestId: string) =>
  new Response(
    JSON.stringify({
      error: {
        code,
        message,
        requestId,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-ID': requestId,
      },
    },
  );

const safeFilename = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'documento.pdf';

export const GET: APIRoute = async (context) => {
  const requestId = getOrCreateRequestId(context.request);
  const id = context.params.id ?? '';

  // 1. Validate UUID structure
  if (!UUID_PATTERN.test(id)) {
    logger.warn(`Solicitud PDF rechazada por UUID inválido: "${id}"`, requestId);
    return jsonError('INVALID_RESOURCE_ID', 'Recurso no encontrado', 404, requestId);
  }

  // 2. Reject client-supplied parameter tampering
  if (context.url.searchParams.has('pdfUrl')) {
    logger.warn(`Intento de alteración de parámetros pdfUrl en recurso "${id}"`, requestId);
    return jsonError('PARAM_NOT_ALLOWED', 'Parámetro no permitido', 400, requestId);
  }

  const supabase = context.locals.supabase;
  let result = supabase
    ? await supabase
        .from('library_resources')
        .select(REQUIRED_SELECT_COLUMNS)
        .eq('id', id)
        .eq('is_published', true)
        .maybeSingle()
    : { data: null, error: new Error('Base de datos no disponible') };

  // Strict Admin Fallback: Triggers ONLY for Postgres RLS permission error 42501
  if (shouldUseAdminFallback(result.error)) {
    logger.info(`Activando fallback de administración controlado por RLS (42501) para "${id}"`, requestId);
    try {
      const adminClient = createSupabaseAdminClient();
      result = await adminClient
        .from('library_resources')
        .select(REQUIRED_SELECT_COLUMNS)
        .eq('id', id)
        .eq('is_published', true)
        .maybeSingle();
    } catch (adminErr) {
      logger.warn(`Fallback de cliente de administración no configurado: ${adminErr}`, requestId);
    }
  }

  if (result.error || !result.data) {
    logger.warn(`Recurso no encontrado o no publicado en BD: "${id}"`, requestId);
    return jsonError('PDF_NOT_FOUND', 'Recurso no encontrado', 404, requestId);
  }

  // Double check publication status
  if (!result.data.is_published) {
    logger.warn(`Intento de acceso a recurso no publicado: "${id}"`, requestId);
    return jsonError('PDF_NOT_FOUND', 'Recurso no encontrado', 404, requestId);
  }

  const fileId = result.data.drive_file_id;
  if (!fileId) {
    logger.error(`Recurso publicado sin drive_file_id: "${id}"`, requestId);
    return jsonError('PDF_SOURCE_UNAVAILABLE', 'Archivo PDF no disponible', 404, requestId);
  }

  // 5. Extract HTTP Range request header if present
  const rangeHeader = context.request.headers.get('range') ?? undefined;

  try {
    // Pass context.request.signal for client disconnect / abort handling
    const file = await streamDriveFile(fileId, rangeHeader, context.request.signal);
    const filename = safeFilename(result.data.drive_file_name || `${result.data.title}.pdf`);

    const headers = new Headers({
      'Content-Type': result.data.drive_mime_type || file.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-ID': requestId,
    });

    if (file.contentLength) {
      headers.set('Content-Length', file.contentLength);
    }

    if (file.contentRange) {
      headers.set('Content-Range', file.contentRange);
    }

    const responseStatus = rangeHeader && (file.contentRange || file.status === 206)
      ? 206
      : (file.status && file.status >= 200 && file.status < 300 ? file.status : 200);

    return new Response(file.stream, {
      status: responseStatus,
      headers,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      logger.info(`Stream cancelado por el navegador para "${id}"`, requestId);
      return new Response(null, { status: 499 }); // Client Closed Request
    }

    logger.error(`Error al transmitir stream para "${id}": ${error instanceof Error ? error.message : String(error)}`, requestId);
    return jsonError('STORAGE_TEMPORARILY_UNAVAILABLE', 'Error al transmitir el documento PDF', 502, requestId);
  }
};
