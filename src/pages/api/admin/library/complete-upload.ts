import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { books as staticBooks } from '../../../../data/books';
import { deleteDriveFile, verifyBrowserLibraryUpload, type DriveUploadResult } from '../../../../lib/google-drive/server';
import { LIBRARY_ADMIN_SELECT, LibraryOperationError, publishLibraryResource } from '../../../../lib/library/admin';
import { isSameOriginRequest, sanitizeLibraryFileName, slugifyLibraryTitle, validateLibraryResourceForm, LibraryValidationError } from '../../../../lib/library/validation';

export const prerender = false;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

const toMetadataForm = (body: Record<string, unknown>) => {
  const form = new FormData();
  for (const key of ['title', 'slug', 'author', 'description', 'category', 'bookType', 'level', 'language', 'pages', 'tags', 'topics', 'badge', 'accent']) {
    if (typeof body[key] === 'string' || typeof body[key] === 'number') form.set(key, String(body[key]));
  }
  if (body.allowDownload === true) form.set('allowDownload', 'true');
  if (body.isFeatured === true) form.set('isFeatured', 'true');
  form.set('status', body.status === 'published' ? 'published' : 'draft');
  return form;
};

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  let pdf: DriveUploadResult | undefined;
  let cover: DriveUploadResult | undefined;
  let insertedId: string | undefined;
  try {
    const body = await context.request.json() as Record<string, unknown>;
    const pdfId = typeof body.driveFileId === 'string' ? body.driveFileId : '';
    const coverId = typeof body.coverDriveFileId === 'string' ? body.coverDriveFileId : '';
    if (!DRIVE_ID_PATTERN.test(pdfId) || (coverId && !DRIVE_ID_PATTERN.test(coverId))) throw new LibraryValidationError('Los archivos subidos no son válidos.');
    const metadata = validateLibraryResourceForm(toMetadataForm(body));
    if (staticBooks.some((book) => book.slug === metadata.slug)) return json({ ok: false, field: 'slug', error: 'Ese slug pertenece a un recurso de muestra protegido.' }, 409);
    const slugLookup = await auth.supabase.from('library_resources').select('id').eq('slug', metadata.slug).maybeSingle();
    if (slugLookup.error) throw slugLookup.error;
    if (slugLookup.data) return json({ ok: false, field: 'slug', error: 'Ya existe un recurso con ese slug.' }, 409);

    pdf = await verifyBrowserLibraryUpload(pdfId, 'pdf');
    cover = coverId ? await verifyBrowserLibraryUpload(coverId, 'cover') : undefined;
    const id = crypto.randomUUID();
    const displaySlug = slugifyLibraryTitle(metadata.title);
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    const internalSlug = `${displaySlug}-${suffix}`;

    const insert = await auth.supabase.from('library_resources').insert({
      id,
      title: metadata.title,
      display_slug: displaySlug,
      slug: internalSlug,
      author: metadata.author,
      description: metadata.description,
      category: metadata.category,
      resource_type: metadata.resourceType,
      level: metadata.level,
      language: metadata.language,
      pages: metadata.pages,
      drive_file_id: pdf.id,
      drive_file_name: sanitizeLibraryFileName(pdf.name, 'documento.pdf'),
      drive_mime_type: pdf.mimeType,
      drive_file_size: pdf.size ?? null,
      cover_drive_file_id: cover?.id ?? null,
      cover_file_name: cover ? sanitizeLibraryFileName(cover.name, 'portada') : null,
      cover_mime_type: cover?.mimeType ?? null,
      cover_file_size: cover?.size ?? null,
      tags: metadata.tags,
      topics: metadata.topics,
      badge: metadata.badge,
      accent: metadata.accent,
      allow_download: metadata.allowDownload,
      is_featured: metadata.isFeatured,
      is_published: false,
      created_by: auth.user.id,
    }).select(LIBRARY_ADMIN_SELECT).single();
    if (insert.error) throw insert.error;
    insertedId = id;
    if (!metadata.requestedPublished) return json({ ok: true, resource: insert.data }, 201);
    try {
      return json({ ok: true, resource: await publishLibraryResource(auth.supabase, id) }, 201);
    } catch (error) {
      return json({ ok: false, error: 'El recurso se creó como borrador porque la publicación falló.', resource: error instanceof LibraryOperationError ? error.resource : insert.data }, 422);
    }
  } catch (error) {
    if (!insertedId) await Promise.allSettled([pdf?.id, cover?.id].filter((id): id is string => Boolean(id)).map(deleteDriveFile));
    if (error instanceof LibraryValidationError) return json({ ok: false, ...(error.field ? { field: error.field } : {}), error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo completar la subida de Biblioteca.' }, 422);
  }
};
