export type UploadKind = 'pdf' | 'cover';

export type UploadDescriptor = {
  filename: string;
  mimeType: string;
  size: number;
  kind: UploadKind;
};

const PDF_MIME = 'application/pdf';
const COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const numericEnv = (value: string, fallback: number) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : fallback;
};

export const isUploadId = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

export const parseUploadDescriptor = (value: unknown, limits: { pdf: string; cover: string }): UploadDescriptor | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const filename = typeof record.filename === 'string' ? record.filename.normalize('NFKC').trim() : '';
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim().toLowerCase() : '';
  const size = typeof record.size === 'number' ? record.size : Number.NaN;
  const kind = record.kind;
  if (!filename || filename.length > 180 || /[\\/\u0000-\u001f]/.test(filename) || !Number.isSafeInteger(size) || size < 1) return undefined;
  if (kind !== 'pdf' && kind !== 'cover') return undefined;
  if (kind === 'pdf' && (!filename.toLowerCase().endsWith('.pdf') || mimeType !== PDF_MIME || size > numericEnv(limits.pdf, 100 * 1024 * 1024))) return undefined;
  if (kind === 'cover' && (!COVER_TYPES.has(mimeType) || size > numericEnv(limits.cover, 8 * 1024 * 1024))) return undefined;
  return { filename, mimeType, size, kind };
};

export const coverExtension = (mimeType: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType] ?? 'bin');

export const hasValidSignature = (bytes: Uint8Array, kind: UploadKind, mimeType: string) => {
  if (kind === 'pdf') return mimeType === PDF_MIME && bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return mimeType === 'image/webp' && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
};
