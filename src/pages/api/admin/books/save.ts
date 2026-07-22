import type { APIRoute } from 'astro';
import { internalApiError, json, requireApiAdmin } from '../../../../lib/api';
import { uploadAdminFile } from '../../../../lib/admin/storage';

export const prerender = false;

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  let bookId = '';
  let coverPath = '';
  try {
    const form = await context.request.formData();
    const title = String(form.get('title') ?? '').trim();
    const author = String(form.get('author') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const cover = form.get('cover');
    const pdf = form.get('pdf');
    if (title.length < 3 || author.length < 2 || !description || !(cover instanceof File) || !(pdf instanceof File)) {
      return json({ error: 'Completa los campos obligatorios y adjunta portada y PDF.' }, 422);
    }

    const pages = Number(form.get('pages'));
    const year = Number(form.get('publicationYear'));
    if (!Number.isInteger(pages) || pages < 1 || !Number.isInteger(year) || year < 1800 || year > 2200) {
      return json({ error: 'Paginas o anio de publicacion invalidos.' }, 422);
    }

    const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await auth.supabase.from('books').insert({
      slug,
      title,
      author,
      description: description.slice(0, 3000),
      category: String(form.get('category') ?? ''),
      level: String(form.get('level') ?? 'Basico'),
      language: String(form.get('language') ?? 'Espanol'),
      pages,
      publication_year: year,
      tags: String(form.get('tags') ?? '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 20),
      allow_download: form.get('allowDownload') === 'on',
      status: form.get('status') === 'published' ? 'published' : 'draft',
      created_by: auth.user.id,
    }).select('id').single();
    if (error) throw error;

    bookId = data.id;
    const uploadedCover = await uploadAdminFile(auth.supabase, 'book-covers', bookId, cover);
    coverPath = uploadedCover.path;
    const uploadedPdf = await uploadAdminFile(auth.supabase, 'book-pdfs', bookId, pdf);
    const { error: updateError } = await auth.supabase.from('books').update({
      cover_path: coverPath,
      pdf_path: uploadedPdf.path,
      file_size_bytes: pdf.size,
    }).eq('id', bookId);
    if (updateError) throw updateError;

    return json({ id: bookId });
  } catch (error) {
    // Limpieza interna de una operacion incompleta; no es una accion expuesta al usuario.
    if (coverPath) await auth.supabase.storage.from('book-covers').remove([coverPath]);
    if (bookId) await auth.supabase.from('books').delete().eq('id', bookId);
    return internalApiError('admin-books-save', error, 'No se pudo guardar el libro.', 422);
  }
};
