import type { SupabaseClient } from '@supabase/supabase-js';

interface StorageRule {
  max: number;
  mime: readonly string[];
  ext: readonly string[];
  public: boolean;
}

export const storageRules = {
  'course-covers': { max: 5 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp'], ext: ['jpg', 'jpeg', 'png', 'webp'], public: true },
  'course-images': { max: 8 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], ext: ['jpg', 'jpeg', 'png', 'webp', 'gif'], public: true },
  'course-resources': { max: 25 * 1024 * 1024, mime: ['application/pdf', 'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], ext: ['pdf', 'zip', 'docx', 'xlsx', 'pptx'], public: false },
  'lesson-videos': { max: 200 * 1024 * 1024, mime: ['video/mp4', 'video/webm'], ext: ['mp4', 'webm'], public: false },
  'book-covers': { max: 5 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp'], ext: ['jpg', 'jpeg', 'png', 'webp'], public: true },
  'book-pdfs': { max: 50 * 1024 * 1024, mime: ['application/pdf'], ext: ['pdf'], public: false },
} as const satisfies Record<string, StorageRule>;

export type AdminBucket = keyof typeof storageRules;

const hasValidSignature = async (file: File, extension: string) => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);

  if (extension === 'pdf') return ascii.startsWith('%PDF-');
  if (['jpg', 'jpeg'].includes(extension)) return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (extension === 'png') return bytes.slice(0, 4).join(',') === '137,80,78,71';
  if (extension === 'webp') return ascii.startsWith('RIFF') && ascii.includes('WEBP');
  if (extension === 'gif') return ascii.startsWith('GIF8');
  if (extension === 'mp4') return ascii.slice(4, 8) === 'ftyp';
  if (extension === 'webm') return bytes.slice(0, 4).join(',') === '26,69,223,163';
  if (['zip', 'docx', 'xlsx', 'pptx'].includes(extension)) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  return false;
};

export const validateAdminFile = async (bucket: string, file: File) => {
  if (!(bucket in storageRules)) throw new Error('Destino no permitido.');

  const rule: StorageRule = storageRules[bucket as AdminBucket];
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!rule.ext.includes(extension) || !rule.mime.includes(file.type)) {
    throw new Error('Tipo o extensión de archivo no permitidos.');
  }
  if (file.size <= 0 || file.size > rule.max) {
    throw new Error(`El archivo supera el máximo de ${Math.round(rule.max / 1024 / 1024)} MB.`);
  }
  if (!(await hasValidSignature(file, extension))) {
    throw new Error('La firma del archivo no coincide con su extensión.');
  }

  return { rule, extension };
};

export const uploadAdminFile = async (
  supabase: SupabaseClient,
  bucket: AdminBucket,
  scopeId: string,
  file: File,
) => {
  const { rule, extension } = await validateAdminFile(bucket, file);
  if (!/^[0-9a-f-]{36}$/i.test(scopeId)) throw new Error('Identificador de destino inválido.');

  const path = `${scopeId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const publicUrl = rule.public
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : undefined;
  return { path, publicUrl };
};
