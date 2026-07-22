import type { CourseLevel, CourseStatus } from '../../types/course';

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: 'Básico',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export const createCourseSlug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export const formatCourseDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Sin definir';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
};

export const formatCourseDate = (value: string | null, emptyLabel = 'Sin definir') => {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatCourseDateTime = (value: string | null, emptyLabel = 'Sin definir') => {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const translateCourseLevel = (level: CourseLevel) => COURSE_LEVEL_LABELS[level];
export const translateCourseStatus = (status: CourseStatus) => COURSE_STATUS_LABELS[status];
