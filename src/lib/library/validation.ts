import {
  LIBRARY_RESOURCE_BADGES,
  LIBRARY_RESOURCE_LEVELS,
  LIBRARY_RESOURCE_TYPES,
  type LibraryResourceBadge,
  type LibraryResourceLevel,
  type LibraryResourceType,
} from './types';

export const LIBRARY_FILE_LIMITS = {
  pdf: 100 * 1024 * 1024,
  cover: 8 * 1024 * 1024,
} as const;

export type LibraryAsset = keyof typeof LIBRARY_FILE_LIMITS;
export type LibraryResourceInput = {
  title: string;
  slug: string;
  author: string | null;
  description: string;
  category: string;
  resourceType: LibraryResourceType;
  level: LibraryResourceLevel;
  language: string;
  pages: number;
  tags: string[];
  topics: string[];
  badge: LibraryResourceBadge | null;
  accent: string;
  allowDownload: boolean;
  isFeatured: boolean;
  requestedPublished: boolean;
};

export class LibraryValidationError extends Error {
  field?: string;
  status: number;

  constructor(message: string, field?: string, status = 422) {
    super(message);
    this.name = 'LibraryValidationError';
    this.field = field;
    this.status = status;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COVER_MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

const normalizeText = (value: unknown, multiline = false) => {
  if (typeof value !== 'string') return '';
  const normalized = value.normalize('NFKC').replace(/\r\n?/g, '\n');
  const withoutControls = multiline
    ? normalized.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    : normalized.replace(/[\u0000-\u001f\u007f]/g, ' ');
  return (multiline ? withoutControls.replace(/[ \t]+/g, ' ') : withoutControls.replace(/\s+/g, ' ')).trim();
};

export const sanitizePlainText = (value: unknown, maxLength: number, options?: { required?: boolean; minLength?: number; multiline?: boolean; field?: string }) => {
  const text = normalizeText(value, options?.multiline);
  const field = options?.field ?? 'Campo';
  const fieldKey = options?.field?.toLowerCase();
  if (options?.required && !text) throw new LibraryValidationError(`${field} es obligatorio.`, options.field?.toLowerCase());
  if (text.length < (options?.minLength ?? 0)) throw new LibraryValidationError(`${field} es demasiado corto.`, fieldKey);
  if (text.length > maxLength) throw new LibraryValidationError(`${field} supera el límite permitido.`, fieldKey);
  return text;
};

export const slugifyLibraryTitle = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 180);

export const sanitizeLibrarySlug = (value: unknown, fallbackTitle?: string) => {
  const requested = normalizeText(value).toLowerCase();
  const slug = requested || slugifyLibraryTitle(fallbackTitle ?? '');
  if (!slug || slug.length > 180 || !SLUG_PATTERN.test(slug)) {
    throw new LibraryValidationError('El slug solo puede contener letras minúsculas, números y guiones.', 'slug');
  }
  return slug;
};

export const sanitizeLibraryFileName = (value: unknown, fallback: string) => {
  const raw = normalizeText(value);
  const basename = raw.replace(/^.*[\\/]/, '');
  const safe = basename
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 255);
  return safe || fallback;
};

const parseList = (value: unknown, maximumItems: number) => {
  const entries = Array.isArray(value) ? value : String(value ?? '').split(',');
  return entries
    .map((item) => sanitizePlainText(item, 80))
    .filter(Boolean)
    .slice(0, maximumItems);
};

const requiredEnum = <T extends string>(value: unknown, values: readonly T[], field: string): T => {
  const sanitized = normalizeText(value);
  if (!values.includes(sanitized as T)) throw new LibraryValidationError(`${field} no es válido.`, field.toLowerCase());
  return sanitized as T;
};

const readBoolean = (value: FormDataEntryValue | null) => value === 'on' || value === 'true';

export const validateLibraryResourceForm = (form: FormData): LibraryResourceInput => {
  const title = sanitizePlainText(form.get('title'), 180, { required: true, minLength: 3, field: 'Título' });
  const pages = Number(form.get('pages'));
  if (!Number.isInteger(pages) || pages < 1 || pages > 100_000) throw new LibraryValidationError('Páginas debe ser un entero mayor que cero.', 'pages');
  const badgeValue = normalizeText(form.get('badge'));
  const badge = badgeValue ? requiredEnum(badgeValue, LIBRARY_RESOURCE_BADGES, 'Distintivo') : null;
  const accentValue = normalizeText(form.get('accent'));

  return {
    title,
    slug: sanitizeLibrarySlug(form.get('slug'), title),
    author: sanitizePlainText(form.get('author'), 160) || null,
    description: sanitizePlainText(form.get('description'), 3000, { required: true, minLength: 20, multiline: true, field: 'Descripción' }),
    category: sanitizePlainText(form.get('category'), 120, { required: true, field: 'Categoría' }),
    resourceType: requiredEnum(form.get('bookType'), LIBRARY_RESOURCE_TYPES, 'Tipo'),
    level: requiredEnum(form.get('level'), LIBRARY_RESOURCE_LEVELS, 'Nivel'),
    language: sanitizePlainText(form.get('language'), 80, { required: true, field: 'Idioma' }),
    pages,
    tags: parseList(form.get('tags'), 20),
    topics: parseList(form.get('topics'), 30),
    badge,
    accent: /^#[0-9a-f]{6}$/i.test(accentValue) ? accentValue : '#16a34a',
    allowDownload: readBoolean(form.get('allowDownload')),
    isFeatured: readBoolean(form.get('isFeatured')),
    requestedPublished: form.get('status') === 'published',
  };
};

const FORBIDDEN_PATCH_FIELDS = new Set([
  'id', 'source', 'drive_file_id', 'cover_drive_file_id', 'drive_view_link', 'drive_download_link',
  'cover_url', 'drive_public_permission_id', 'cover_public_permission_id', 'created_by', 'created_at',
  'updated_at', 'is_published', 'file_error', 'pdfUrl', 'coverUrl', 'downloadUrl', 'path', 'filePath',
]);

export const validateLibraryResourcePatch = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LibraryValidationError('Solicitud JSON inválida.');
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => FORBIDDEN_PATCH_FIELDS.has(key))) {
    throw new LibraryValidationError('La solicitud contiene campos administrados exclusivamente por el servidor.');
  }
  const updates: Record<string, string | number | boolean | string[] | null> = {};
  if ('title' in record) updates.title = sanitizePlainText(record.title, 180, { required: true, minLength: 3, field: 'Título' });
  if ('slug' in record) updates.slug = sanitizeLibrarySlug(record.slug);
  if ('author' in record) updates.author = sanitizePlainText(record.author, 160) || null;
  if ('description' in record) updates.description = sanitizePlainText(record.description, 3000, { required: true, minLength: 20, multiline: true, field: 'Descripción' });
  if ('category' in record) updates.category = sanitizePlainText(record.category, 120, { required: true, field: 'Categoría' });
  if ('resourceType' in record) updates.resource_type = requiredEnum(record.resourceType, LIBRARY_RESOURCE_TYPES, 'Tipo');
  if ('level' in record) updates.level = requiredEnum(record.level, LIBRARY_RESOURCE_LEVELS, 'Nivel');
  if ('language' in record) updates.language = sanitizePlainText(record.language, 80, { required: true, field: 'Idioma' });
  if ('pages' in record) {
    const pages = Number(record.pages);
    if (!Number.isInteger(pages) || pages < 1 || pages > 100_000) throw new LibraryValidationError('Páginas debe ser un entero mayor que cero.', 'pages');
    updates.pages = pages;
  }
  if ('tags' in record) updates.tags = parseList(record.tags, 20);
  if ('topics' in record) updates.topics = parseList(record.topics, 30);
  if ('isFeatured' in record) {
    if (typeof record.isFeatured !== 'boolean') throw new LibraryValidationError('Destacado no es válido.');
    updates.is_featured = record.isFeatured;
  }
  if ('allowDownload' in record) {
    if (typeof record.allowDownload !== 'boolean') throw new LibraryValidationError('Permitir descarga no es válido.');
    updates.allow_download = record.allowDownload;
  }
  if ('accent' in record) {
    if (typeof record.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(record.accent)) throw new LibraryValidationError('Color de acento no válido.', 'accent');
    updates.accent = record.accent;
  }
  if ('badge' in record) updates.badge = record.badge === null || record.badge === '' ? null : requiredEnum(record.badge, LIBRARY_RESOURCE_BADGES, 'Distintivo');
  if (!Object.keys(updates).length) throw new LibraryValidationError('No hay cambios válidos.');
  return updates;
};

export const validateLibraryUploadDescriptor = (asset: LibraryAsset, originalNameValue: unknown, mimeTypeValue: unknown, sizeValue: unknown) => {
  const originalName = sanitizeLibraryFileName(originalNameValue, asset === 'pdf' ? 'documento.pdf' : 'portada');
  const mimeType = normalizeText(mimeTypeValue);
  const size = Number(sizeValue);
  if (!Number.isInteger(size) || size < 1 || size > LIBRARY_FILE_LIMITS[asset]) throw new LibraryValidationError(`El archivo supera el tamaño permitido para ${asset === 'pdf' ? 'PDF' : 'portada'}.`);
  const extension = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
  if (asset === 'pdf' && (mimeType !== 'application/pdf' || extension !== 'pdf')) throw new LibraryValidationError('El documento debe ser PDF y usar extensión .pdf.');
  if (asset === 'cover' && (!COVER_MIME_EXTENSIONS[mimeType]?.includes(extension))) throw new LibraryValidationError('La portada debe ser JPG, PNG o WebP y su extensión debe coincidir con el MIME.');
  return { originalName, mimeType, size };
};

export const validateManagedDriveFileMetadata = (asset: LibraryAsset, file: { name: string; mimeType: string; size?: number }) =>
  validateLibraryUploadDescriptor(asset, file.name, file.mimeType, file.size ?? 0);

export const isLibraryUuid = (value: string) => UUID_PATTERN.test(value);
export const isSameOriginRequest = (request: Request, url: URL) => !request.headers.get('origin') || request.headers.get('origin') === url.origin;
