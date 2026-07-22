import type { APIRoute } from 'astro';
import { internalApiError, json, requireApiAdmin } from '../../../../lib/api';
import { storageRules, uploadAdminFile, type AdminBucket } from '../../../../lib/admin/storage';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  try {
    const form = await context.request.formData();
    const file = form.get('file');
    const bucket = String(form.get('bucket') ?? '') as AdminBucket;
    if (!(file instanceof File) || !(bucket in storageRules)) {
      return json({ error: 'Archivo o destino invalido.' }, 422);
    }

    const courseId = String(form.get('courseId') ?? '');
    const lessonId = String(form.get('lessonId') ?? '');
    const bookId = String(form.get('bookId') ?? '');
    const scopeId = bookId || courseId;
    if (!scopeId) return json({ error: 'Falta el destino del archivo.' }, 422);

    const uploaded = await uploadAdminFile(auth.supabase, bucket, scopeId, file);
    if (['course-images', 'course-resources', 'lesson-videos'].includes(bucket) && courseId) {
      const { error } = await auth.supabase.from('course_resources').insert({
        course_id: courseId,
        lesson_id: lessonId || null,
        bucket,
        object_path: uploaded.path,
        original_name: file.name.slice(0, 180),
        mime_type: file.type,
        size_bytes: file.size,
        resource_type: bucket === 'lesson-videos' ? 'video' : bucket === 'course-images' ? 'image' : 'file',
        created_by: auth.user.id,
      });
      if (error) {
        await auth.supabase.storage.from(bucket).remove([uploaded.path]);
        throw error;
      }
    }
    return json(uploaded);
  } catch (error) {
    return internalApiError('admin-storage-upload', error, 'No se pudo cargar el archivo.', 422);
  }
};
