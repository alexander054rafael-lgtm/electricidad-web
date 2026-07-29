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
 * - Request Tracing: Assigns/forwards X-Request-ID for end-to-end telemetry and debugging.
 * - HTTP Range Support: Supports 206 Partial Content range requests (Accept-Ranges: bytes, Content-Range)
 *   enabling PDF.js to stream chunks of large PDFs on demand.
 */

import type { APIRoute } from 'astro';
import { streamDriveFile } from '../../../../../lib/google-drive/server';
import { getOrCreateRequestId, logger } from '../../../../../lib/logger';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return new Response('Recurso no encontrado', { status: 404, headers: { 'X-Request-ID': requestId } });
  }

  // 2. Reject client-supplied parameter tampering
  if (context.url.searchParams.has('pdfUrl')) {
    logger.warn(`Intento de alteración de parámetros pdfUrl en recurso "${id}"`, requestId);
    return new Response('Parámetro no permitido', { status: 400, headers: { 'X-Request-ID': requestId } });
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    logger.error('Cliente Supabase no disponible en contexto SSR', requestId);
    return new Response('Base de datos no disponible', { status: 503, headers: { 'X-Request-ID': requestId } });
  }

  // 3. Autonomous database query
  const result = await supabase
    .from('library_resources')
    .select('title,is_published,drive_file_id,drive_mime_type,drive_file_name')
    .eq('id', id)
    .maybeSingle();

  if (result.error || !result.data) {
    logger.warn(`Recurso no encontrado en BD: "${id}"`, requestId);
    return new Response('Recurso no encontrado', { status: 404, headers: { 'X-Request-ID': requestId } });
  }

  // 4. Security Hardening: Return 404 for unpublished resources to prevent enumeration
  if (!result.data.is_published) {
    logger.warn(`Intento de acceso a recurso no publicado: "${id}"`, requestId);
    return new Response('Recurso no encontrado', { status: 404, headers: { 'X-Request-ID': requestId } });
  }

  const fileId = result.data.drive_file_id;
  if (!fileId) {
    logger.error(`Recurso publicado sin drive_file_id: "${id}"`, requestId);
    return new Response('Archivo PDF no disponible', { status: 404, headers: { 'X-Request-ID': requestId } });
  }

  // 5. Extract HTTP Range request header if present
  const rangeHeader = context.request.headers.get('range') ?? undefined;

  try {
    const file = await streamDriveFile(fileId, rangeHeader);
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
    logger.error(`Error al transmitir stream de Drive para "${id}": ${error instanceof Error ? error.message : String(error)}`, requestId);
    return new Response('Error al transmitir el documento PDF', { status: 502, headers: { 'X-Request-ID': requestId } });
  }
};
