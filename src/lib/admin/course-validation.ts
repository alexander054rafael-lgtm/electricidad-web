import type {
  CourseFormErrors,
  CourseFormValues,
  CourseLevel,
  CourseStatus,
} from '../../types/course';

export const COURSE_LEVELS: readonly CourseLevel[] = ['beginner', 'intermediate', 'advanced'];
export const COURSE_STATUSES: readonly CourseStatus[] = ['draft', 'published', 'archived'];

const readText = (form: FormData, field: string) => String(form.get(field) ?? '').trim();
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const readCourseForm = (form: FormData): CourseFormValues => ({
  title: readText(form, 'title'),
  slug: readText(form, 'slug').toLowerCase(),
  short_description: readText(form, 'short_description'),
  description: readText(form, 'description'),
  cover_url: readText(form, 'cover_url'),
  category: readText(form, 'category'),
  level: readText(form, 'level') as CourseLevel,
  status: readText(form, 'status') as CourseStatus,
  duration_minutes: readText(form, 'duration_minutes'),
  position: readText(form, 'position'),
  is_featured: form.get('is_featured') === 'on',
  instructor_id: readText(form, 'instructor_id'),
});

export const validateCourseForm = (
  values: CourseFormValues,
  allowedInstructorIds: ReadonlySet<string>,
): CourseFormErrors => {
  const errors: CourseFormErrors = {};

  if (!values.title) errors.title = 'El título es obligatorio.';
  else if (values.title.length < 3) errors.title = 'El título debe tener al menos 3 caracteres.';
  else if (values.title.length > 120) errors.title = 'El título no puede superar 120 caracteres.';

  if (!values.slug) errors.slug = 'El slug es obligatorio.';
  else if (values.slug.length > 140) errors.slug = 'El slug no puede superar 140 caracteres.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
    errors.slug = 'Usa solo minúsculas, números y guiones simples.';
  }

  if (values.short_description.length > 240) {
    errors.short_description = 'La descripción corta no puede superar 240 caracteres.';
  }
  if (values.description.length > 20000) {
    errors.description = 'La descripción completa no puede superar 20 000 caracteres.';
  }

  if (values.cover_url) {
    try {
      const cover = new URL(values.cover_url);
      if (cover.protocol !== 'https:') errors.cover_url = 'La portada debe usar una URL HTTPS.';
    } catch {
      errors.cover_url = 'Introduce una URL de portada válida.';
    }
  }

  if (values.category.length > 80) errors.category = 'La categoría no puede superar 80 caracteres.';
  if (!COURSE_LEVELS.includes(values.level)) errors.level = 'Selecciona un nivel válido.';
  if (!COURSE_STATUSES.includes(values.status)) errors.status = 'Selecciona un estado válido.';

  const duration = Number(values.duration_minutes);
  if (!/^\d+$/.test(values.duration_minutes) || !Number.isSafeInteger(duration)) {
    errors.duration_minutes = 'La duración debe ser un número entero.';
  } else if (duration < 0 || duration > 100000) {
    errors.duration_minutes = 'La duración debe estar entre 0 y 100 000 minutos.';
  }

  const position = Number(values.position);
  if (!/^\d+$/.test(values.position) || !Number.isSafeInteger(position)) {
    errors.position = 'La posición debe ser un número entero.';
  } else if (position < 0 || position > 1000000) {
    errors.position = 'La posición debe estar entre 0 y 1 000 000.';
  }

  if (values.instructor_id && (!isUuid(values.instructor_id) || !allowedInstructorIds.has(values.instructor_id))) {
    errors.instructor_id = 'Selecciona un instructor válido.';
  }

  return errors;
};
