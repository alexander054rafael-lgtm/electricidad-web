export const LIBRARY_RESOURCE_TYPES = [
  'Libro',
  'Manual',
  'Guía',
  'Catálogo',
  'Ficha técnica',
  'Norma',
  'Documento',
] as const;

export const LIBRARY_RESOURCE_LEVELS = ['Básico', 'Intermedio', 'Avanzado'] as const;
export const LIBRARY_RESOURCE_BADGES = ['Nuevo', 'Popular', 'Recomendado'] as const;

export type LibraryResourceSource = 'static' | 'database';
export type LibraryResourceType = typeof LIBRARY_RESOURCE_TYPES[number];
export type LibraryResourceLevel = typeof LIBRARY_RESOURCE_LEVELS[number];
export type LibraryResourceBadge = typeof LIBRARY_RESOURCE_BADGES[number];

type LibraryResourcePresentation = {
  id: string;
  source: LibraryResourceSource;
  slug: string;
  title: string;
  author: string;
  description: string;
  category: string;
  level: LibraryResourceLevel;
  type: LibraryResourceType;
  language: string;
  pages: number;
  publicationYear: number;
  fileSize: string;
  downloads: number;
  tags: string[];
  badge?: LibraryResourceBadge;
  accent: string;
  topics: string[];
  pdfUrl: string;
  downloadUrl?: string;
  coverUrl?: string;
  isFeatured?: boolean;
  allowDownload: boolean;
};

export type StaticLibraryResource = LibraryResourcePresentation & {
  id: `static-${string}`;
  source: 'static';
};

export type DatabaseLibraryResource = LibraryResourcePresentation & {
  source: 'database';
};

export type LibraryResource = StaticLibraryResource | DatabaseLibraryResource;

export type DatabaseLibraryResourceRow = {
  id: string;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  category: string;
  resource_type: LibraryResourceType;
  level: LibraryResourceLevel | null;
  language: string;
  pages: number | null;
  drive_file_id: string;
  drive_view_link: string | null;
  drive_download_link: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
  cover_drive_file_id: string | null;
  cover_url: string | null;
  cover_file_name: string | null;
  cover_mime_type: string | null;
  cover_file_size: number | null;
  tags: string[] | null;
  topics: string[] | null;
  badge: LibraryResourceBadge | null;
  accent: string | null;
  allow_download: boolean;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminLibraryResource = DatabaseLibraryResourceRow & {
  drive_public_permission_id: string | null;
  cover_public_permission_id: string | null;
  file_error: string | null;
  created_by: string | null;
};
