import type { SupabaseClient } from '@supabase/supabase-js';
import { books as sampleBooks } from '../../data/books';
import type { DatabaseLibraryResource, DatabaseLibraryResourceRow, LibraryResource, StaticLibraryResource } from './types';

export const DATABASE_BOOK_SELECT = 'id,title,slug,display_slug,author,description,category,resource_type,level,language,pages,drive_file_id,drive_view_link,drive_download_link,drive_file_name,drive_mime_type,drive_file_size,cover_drive_file_id,cover_url,cover_file_name,cover_mime_type,cover_file_size,tags,topics,badge,accent,allow_download,manual_page_labels_enabled,manual_page_start_physical,manual_page_start_number,manual_page_prefix,manual_page_suffix,manual_page_roman_preliminaries,manual_page_preliminary_end_physical,storage_backend,is_featured,is_published,created_at,updated_at';

export const PUBLIC_BOOK_SELECT = 'id,title,slug,display_slug,author,description,category,resource_type,level,language,pages,drive_file_size,cover_drive_file_id,cover_url,cover_file_name,cover_mime_type,tags,topics,badge,accent,allow_download,manual_page_labels_enabled,manual_page_start_physical,manual_page_start_number,manual_page_prefix,manual_page_suffix,manual_page_roman_preliminaries,manual_page_preliminary_end_physical,is_featured,is_published,created_at,updated_at';

export type DatabaseBookRow = DatabaseLibraryResourceRow;

const formatFileSize = (bytes: number | null) => {
  if (!bytes || bytes < 1) return 'PDF';
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const safeAccent = (value: string | null) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '#16a34a';
const safeDriveUrl = (value: string | null) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const isAllowedHost = url.hostname === 'drive.google.com' || url.hostname === 'lh3.googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com');
    return url.protocol === 'https:' && isAllowedHost ? url.toString() : undefined;
  } catch { return undefined; }
};

export const staticResources: StaticLibraryResource[] = sampleBooks.map((book) => ({
  ...book,
  id: `static-${book.slug}`,
  source: 'static',
}));

const WORKER_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_LIBRARY_WORKER_URL) || 'https://indutech-library-file-worker.alexander054rafael.workers.dev';

export const mapDatabaseBook = (row: DatabaseBookRow): DatabaseLibraryResource => ({
  id: row.id,
  source: 'database',
  slug: row.slug,
  displaySlug: row.display_slug || row.slug,
  title: row.title,
  author: row.author || 'InduTech Academy',
  description: row.description || '',
  category: row.category,
  level: row.level ?? 'Básico',
  type: row.resource_type,
  language: row.language,
  pages: row.pages ?? 1,
  publicationYear: new Date(row.created_at).getUTCFullYear(),
  fileSize: formatFileSize(row.drive_file_size),
  downloads: 0,
  tags: row.tags ?? [],
  badge: row.badge ?? undefined,
  accent: safeAccent(row.accent),
  topics: row.topics?.length ? row.topics : row.tags ?? [],
  pdfUrl: `/api/library/books/${row.id}/pdf`,
  downloadUrl: `/api/library/books/${row.id}/pdf`,
  coverUrl: row.cover_drive_file_id
    ? `${WORKER_BASE_URL}/v1/library/covers/${row.id}`
    : safeDriveUrl(row.cover_url),
  isFeatured: Boolean(row.is_featured),
  allowDownload: row.allow_download,
  manualPageLabelConfig: {
    enabled: Boolean(row.manual_page_labels_enabled),
    startPhysicalPage: row.manual_page_start_physical ?? null,
    startNumber: row.manual_page_start_number ?? null,
    prefix: row.manual_page_prefix ?? null,
    suffix: row.manual_page_suffix ?? null,
    romanPreliminaries: Boolean(row.manual_page_roman_preliminaries),
    preliminaryEndPhysicalPage: row.manual_page_preliminary_end_physical ?? null,
  },
});

export const mergeLibraryResources = (dynamicResources: LibraryResource[]): LibraryResource[] => {
  const usedSlugs = new Set(staticResources.map((book) => book.slug));
  const usedIds = new Set<string>(staticResources.map((book) => book.id));
  const uniqueDynamic = dynamicResources.filter((book) => {
    if (usedSlugs.has(book.slug) || (book.id && usedIds.has(book.id))) return false;
    usedSlugs.add(book.slug);
    if (book.id) usedIds.add(book.id);
    return true;
  });

  const featuredDynamic = uniqueDynamic.filter((book) => book.isFeatured);
  const nonFeaturedDynamic = uniqueDynamic.filter((book) => !book.isFeatured);
  const orderedDynamic = [...featuredDynamic, ...nonFeaturedDynamic];

  const totalVisible = Math.max(orderedDynamic.length, staticResources.length);
  return Array.from(
    { length: totalVisible },
    (_, index) => orderedDynamic[index] ?? staticResources[index]
  );
};

export const getPublishedDatabaseBooks = async (supabase: SupabaseClient | null) => {
  if (!supabase) return { books: [] as DatabaseLibraryResource[], error: new Error('Database client unavailable') };
  const result = await supabase
    .from('library_resources')
    .select(PUBLIC_BOOK_SELECT)
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('updated_at', { ascending: false });

  return {
    books: ((result.data ?? []) as unknown as DatabaseBookRow[]).map(mapDatabaseBook),
    error: result.error,
  };
};

export const getUserReadingProgress = async (
  supabase: SupabaseClient | null,
  userId: string | null
): Promise<Record<string, { lastPage: number; totalPages: number; percent: number; updatedAt?: string }>> => {
  if (!supabase || !userId) return {};
  try {
    const { data, error } = await supabase
      .from('user_reading_progress')
      .select('resource_id, last_page, total_pages, progress_percent, updated_at')
      .eq('user_id', userId);

    if (error || !data) return {};

    const progressMap: Record<string, { lastPage: number; totalPages: number; percent: number; updatedAt?: string }> = {};
    for (const row of data) {
      const percent = Number(row.progress_percent ?? 0);
      if (row.resource_id && row.last_page && row.total_pages && percent > 0) {
        progressMap[row.resource_id] = {
          lastPage: Number(row.last_page),
          totalPages: Number(row.total_pages),
          percent: Math.round(percent),
          updatedAt: row.updated_at ?? undefined,
        };
      }
    }
    return progressMap;
  } catch {
    return {};
  }
};
