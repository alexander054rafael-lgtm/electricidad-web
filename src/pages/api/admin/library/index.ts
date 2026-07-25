import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { books as staticBooks } from '../../../../data/books';
import { deleteDriveFile, uploadLibraryCover, uploadLibraryPdf, verifyDriveManagedUpload, type DriveUploadResult } from '../../../../lib/google-drive/server';
import { LIBRARY_ADMIN_SELECT, LibraryOperationError, publishLibraryResource } from '../../../../lib/library/admin';
import { isSameOriginRequest, parseLibraryUploadTicket, validateLibraryResourceForm, validateLibraryUploadDescriptor, LibraryValidationError } from '../../../../lib/library/validation';
import { LIBRARY_RESOURCE_TYPES } from '../../../../lib/library/types';

export const prerender = false;
const asFile = (value: FormDataEntryValue | null) => value instanceof File && value.size ? value : null;

export const GET: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  const page = Math.max(1, Number.parseInt(context.url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(context.url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const from = (page - 1) * pageSize;
  const search = context.url.searchParams.get('q')?.trim();
  const category = context.url.searchParams.get('category')?.trim();
  const type = context.url.searchParams.get('type')?.trim();
  const state = context.url.searchParams.get('state');
  let query = auth.supabase.from('library_resources').select(LIBRARY_ADMIN_SELECT, { count: 'exact' }).order('updated_at', { ascending: false });
  if (search) query = query.or(`title.ilike.%${search.replace(/[%_,()]/g, '')}%,author.ilike.%${search.replace(/[%_,()]/g, '')}%`);
  if (category) query = query.eq('category', category);
  if (type && LIBRARY_RESOURCE_TYPES.includes(type as typeof LIBRARY_RESOURCE_TYPES[number])) query = query.eq('resource_type', type);
  if (state === 'published') query = query.eq('is_published', true);
  if (state === 'draft') query = query.eq('is_published', false);
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) return json({ ok: false, error: 'No se pudo consultar la Biblioteca.' }, 500);
  return json({ ok: true, resources: result.data ?? [], pagination: { page, pageSize, total: result.count ?? 0, pages: Math.ceil((result.count ?? 0) / pageSize) } });
};

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  let pdf: DriveUploadResult | undefined;
  let cover: DriveUploadResult | undefined;
  let insertedId: string | undefined;
  try {
    const form = await context.request.formData();
    const metadata = validateLibraryResourceForm(form);
    const { title, slug, author, description, category, resourceType, level, language, pages, tags, topics, badge, accent, allowDownload, isFeatured, requestedPublished } = metadata;
    if (staticBooks.some((book) => book.slug === slug)) return json({ ok: false, field: 'slug', error: 'Ese slug pertenece a un recurso de muestra protegido.' }, 409);
    const slugLookup = await auth.supabase.from('library_resources').select('id').eq('slug', slug).maybeSingle();
    if (slugLookup.error) throw slugLookup.error;
    if (slugLookup.data) return json({ ok: false, field: 'slug', error: 'Ya existe un recurso con ese slug.' }, 409);

    const pdfFile = asFile(form.get('pdf'));
    const coverFile = asFile(form.get('cover'));
    const pdfTicket = parseLibraryUploadTicket(form.get('pdfDriveUpload') ?? form.get('driveUpload'), 'pdf');
    const coverTicket = parseLibraryUploadTicket(form.get('coverDriveUpload'), 'cover');
    if (!(pdfFile || pdfTicket)) return json({ ok: false, error: 'El PDF es obligatorio.' }, 422);
    if (pdfFile) validateLibraryUploadDescriptor('pdf', pdfFile.name, pdfFile.type, pdfFile.size);
    if (coverFile) validateLibraryUploadDescriptor('cover', coverFile.name, coverFile.type, coverFile.size);

    pdf = pdfTicket ? await verifyDriveManagedUpload(pdfTicket.id, pdfTicket.uploadNonce, 'pdf') : await uploadLibraryPdf(pdfFile!);
    cover = coverTicket ? await verifyDriveManagedUpload(coverTicket.id, coverTicket.uploadNonce, 'cover') : coverFile ? await uploadLibraryCover(coverFile) : undefined;
    const id = crypto.randomUUID();
    const insert = await auth.supabase.from('library_resources').insert({
      id, title, slug, author: author || null, description: description || null, category, resource_type: resourceType, level, language, pages,
      drive_file_id: pdf.id, drive_file_name: pdfTicket?.originalName ?? pdfFile?.name ?? pdf.name, drive_mime_type: pdf.mimeType, drive_file_size: pdf.size ?? null,
      cover_drive_file_id: cover?.id ?? null, cover_file_name: coverTicket?.originalName ?? coverFile?.name ?? cover?.name ?? null, cover_mime_type: cover?.mimeType ?? null, cover_file_size: cover?.size ?? null,
      tags, topics, badge, accent, allow_download: allowDownload, is_featured: isFeatured, is_published: false, created_by: auth.user.id,
    }).select(LIBRARY_ADMIN_SELECT).single();
    if (insert.error) throw insert.error;
    insertedId = id;
    if (!requestedPublished) return json({ ok: true, resource: insert.data }, 201);
    try {
      const published = await publishLibraryResource(auth.supabase, id);
      return json({ ok: true, resource: published }, 201);
    } catch (error) {
      const draft = error instanceof LibraryOperationError ? error.resource : insert.data;
      return json({ ok: false, error: 'El recurso se creó como borrador porque la publicación falló.', resource: draft }, 422);
    }
  } catch (error) {
    if (!insertedId) await Promise.allSettled([pdf?.id, cover?.id].filter((value): value is string => Boolean(value)).map(deleteDriveFile));
    const databaseError = error as { code?: string };
    if (databaseError.code === '23505') return json({ ok: false, field: 'slug', error: 'Ya existe un recurso con ese slug.' }, 409);
    if (error instanceof LibraryValidationError) return json({ ok: false, ...(error.field ? { field: error.field } : {}), error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo crear el recurso.' }, 422);
  }
};
