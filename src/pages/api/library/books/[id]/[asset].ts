import type { APIRoute } from 'astro';
import { requireApiAdmin } from '../../../../../lib/api';
import { streamDriveFile } from '../../../../../lib/google-drive/server';

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeFilename = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'archivo';

export const GET: APIRoute = async (context) => {
  const admin = requireApiAdmin(context);
  if (!admin.ok) return admin.response;
  const id = context.params.id ?? '';
  const asset = context.params.asset;
  if (!UUID_PATTERN.test(id) || (asset !== 'cover' && asset !== 'pdf')) {
    return new Response('No encontrado', { status: 404 });
  }

  const result = await admin.supabase
    .from('library_resources')
    .select('title,is_published,allow_download,cover_drive_file_id,drive_file_id,cover_mime_type,drive_mime_type,cover_file_name,drive_file_name')
    .eq('id', id)
    .maybeSingle();

  if (result.error || !result.data) return new Response('No encontrado', { status: 404 });

  // La Biblioteca pública usa enlaces directos de Drive. Este stream queda
  // reservado para la previsualización administrativa de archivos privados.
  if (asset === 'pdf' && context.url.searchParams.get('download') === '1' && !result.data.allow_download) {
    return new Response('Descarga no permitida', { status: 403 });
  }

  const fileId = asset === 'cover' ? result.data.cover_drive_file_id : result.data.drive_file_id;
  if (!fileId) return new Response('No encontrado', { status: 404 });

  try {
    const file = await streamDriveFile(fileId);
    const configuredMime = asset === 'cover' ? result.data.cover_mime_type : result.data.drive_mime_type;
    const originalName = asset === 'cover' ? result.data.cover_file_name : result.data.drive_file_name;
    const shouldDownload = asset === 'pdf' && context.url.searchParams.get('download') === '1';
    const extension = asset === 'pdf' ? '.pdf' : '';
    const filename = safeFilename(originalName || `${result.data.title}${extension}`);

    return new Response(file.stream, {
      headers: {
        'Content-Type': configuredMime || file.contentType,
        'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': result.data.is_published ? 'public, max-age=300' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Archivo temporalmente no disponible', { status: 502 });
  }
};
