export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export type CourseStatus = 'draft' | 'published' | 'archived';

export interface CourseInstructor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

/** Representación de una fila de `public.courses` en Supabase. */
export interface Course {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  level: CourseLevel;
  status: CourseStatus;
  duration_minutes: number;
  position: number;
  is_featured: boolean;
  instructor_id: string | null;
  instructor?: CourseInstructor | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CourseFormValues {
  title: string;
  slug: string;
  short_description: string;
  description: string;
  cover_url: string;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  duration_minutes: string;
  position: string;
  is_featured: boolean;
  instructor_id: string;
}

export type CourseFormField = keyof CourseFormValues;
export type CourseFormErrors = Partial<Record<CourseFormField, string>>;

export interface CourseInstructorOption {
  id: string;
  full_name: string | null;
  role: 'instructor' | 'admin';
}
