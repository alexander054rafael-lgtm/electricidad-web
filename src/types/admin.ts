export const ADMIN_BLOCK_TYPES = ['heading','paragraph','list','image','gallery','video','formula','table','note','tip','warning','danger','example','steps','resource','assessment','game','book'] as const;
export type AdminBlockType = typeof ADMIN_BLOCK_TYPES[number];
export const isAdminBlockType = (value: unknown): value is AdminBlockType =>
  typeof value === 'string' && (ADMIN_BLOCK_TYPES as readonly string[]).includes(value);
export type AdminBookOption = { id: string; title: string; author: string; status?: string };
export type AdminBlock = { clientId: string; type: AdminBlockType; content: Record<string, unknown> };
export type AdminLesson = { clientId: string; title: string; slug: string; description: string; estimatedMinutes: number; status: 'draft' | 'published'; bookIds: string[]; blocks: AdminBlock[] };
export type AdminModule = { clientId: string; title: string; description: string; bookIds: string[]; lessons: AdminLesson[] };
export type AdminCourseDraft = {
  id?: string; slug: string; title: string; shortDescription: string; description: string;
  category: string; level: 'Básico' | 'Intermedio' | 'Avanzado'; durationHours: number;
  instructorName: string; coverPath: string; published: boolean; bookIds: string[]; modules: AdminModule[];
};

export interface AdminStudentRecord {
  id: string;
  full_name: string | null;
  created_at: string;
}

export interface AdminEnrollmentRecord {
  user_id: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface AdminProgressRecord {
  user_id: string;
  progress_percent: number;
  status: 'in_progress' | 'completed';
}

export interface AdminCourseRecord {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  category: string;
  level: AdminCourseDraft['level'];
  duration_minutes: number;
  instructor_id: string | null;
  cover_url: string | null;
  status: 'draft' | 'published' | 'archived';
}

export interface AdminModuleRecord {
  id: string;
  title: string;
  description: string;
}

export interface AdminLessonRecord {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  description: string;
  estimated_minutes: number;
  status: AdminLesson['status'];
}

export interface AdminBlockRecord {
  id: string;
  lesson_id: string;
  type: AdminBlockType;
  content: Record<string, unknown>;
}

export interface AdminBookRelation {
  book_id: string;
  module_id?: string;
  lesson_id?: string;
}
