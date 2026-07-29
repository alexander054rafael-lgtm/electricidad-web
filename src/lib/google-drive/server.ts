import { Readable } from 'node:stream';
import { getSecret } from 'astro:env/server';
import { google } from 'googleapis';
import { LIBRARY_FILE_LIMITS, validateManagedDriveFileMetadata } from '../library/validation';

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const TEST_FILE_NAME = 'indutech-drive-test.txt';
const TEST_FILE_CONTENT = 'Conexión OAuth de InduTech Academy con Google Drive verificada.';
const LIBRARY_PDF_FOLDER_NAME = 'PDFs';
const LIBRARY_COVER_FOLDER_NAME = 'Portadas';
const PDF_MIME_TYPE = 'application/pdf';
const COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type LibraryAssetKind = 'pdf' | 'cover';

export type SafeDriveFolder = {
  id: string;
  name: string;
  mimeType: string;
  driveId?: string;
  canAddChildren?: boolean;
};

export type SafeDriveTestFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  webViewLink?: string;
  driveId?: string;
};

export type DriveUploadResult = SafeDriveTestFile & {
  size?: number;
  webContentLink?: string;
};

export type DriveDownloadResult = {
  bytes: Uint8Array;
  contentType: string;
  contentLength?: string;
};

export type DriveStreamResult = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: string;
  contentRange?: string;
  status?: number;
};

export type LibraryDriveFolders = {
  pdfs: SafeDriveFolder;
  covers: SafeDriveFolder;
};

export class GoogleDriveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveConfigurationError';
  }
}

const getRequiredEnvironmentVariable = (name: string) => {
  const value = getSecret(name)?.trim();
  if (!value) throw new GoogleDriveConfigurationError(`Falta la variable privada ${name}.`);
  return value;
};

const getDriveContext = () => {
  const folderId = getRequiredEnvironmentVariable('GOOGLE_DRIVE_FOLDER_ID');
  const clientId = getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = getRequiredEnvironmentVariable('GOOGLE_OAUTH_REFRESH_TOKEN');
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return { auth, drive: google.drive({ version: 'v3', auth }), folderId };
};

const requireStringField = (value: string | null | undefined, field: string) => {
  if (!value) throw new Error(`Google Drive no devolvió el campo requerido ${field}.`);
  return value;
};

const sanitizeDriveName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120) || 'recurso';

const toDriveUploadResult = (data: {
  id?: string | null; name?: string | null; mimeType?: string | null; parents?: string[] | null;
  webViewLink?: string | null; webContentLink?: string | null; driveId?: string | null; size?: string | number | null;
}): DriveUploadResult => ({
  id: requireStringField(data.id, 'id'),
  name: requireStringField(data.name, 'name'),
  mimeType: requireStringField(data.mimeType, 'mimeType'),
  parents: data.parents ?? [],
  ...(data.webViewLink ? { webViewLink: data.webViewLink } : {}),
  ...(data.webContentLink ? { webContentLink: data.webContentLink } : {}),
  ...(data.driveId ? { driveId: data.driveId } : {}),
  ...(data.size ? { size: Number(data.size) } : {}),
});

let libraryFoldersPromise: Promise<LibraryDriveFolders> | undefined;

const findOrCreateLibraryFolder = async (name: string, marker: string): Promise<SafeDriveFolder> => {
  const { drive, folderId } = getDriveContext();
  const escapedName = name.replace(/'/g, "\\'");
  const { data: list } = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escapedName}' and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and trashed = false`,
    spaces: 'drive',
    pageSize: 10,
    orderBy: 'createdTime',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id,name,mimeType,driveId,capabilities(canAddChildren))',
  });
  const existing = list.files?.[0];
  if (existing) {
    return {
      id: requireStringField(existing.id, 'id'),
      name: requireStringField(existing.name, 'name'),
      mimeType: requireStringField(existing.mimeType, 'mimeType'),
      ...(existing.driveId ? { driveId: existing.driveId } : {}),
      ...(typeof existing.capabilities?.canAddChildren === 'boolean' ? { canAddChildren: existing.capabilities.canAddChildren } : {}),
    };
  }
  const { data: created } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [folderId],
      appProperties: { indutechLibraryFolder: marker },
    },
    fields: 'id,name,mimeType,driveId,capabilities(canAddChildren)',
  });
  return {
    id: requireStringField(created.id, 'id'),
    name: requireStringField(created.name, 'name'),
    mimeType: requireStringField(created.mimeType, 'mimeType'),
    ...(created.driveId ? { driveId: created.driveId } : {}),
    ...(typeof created.capabilities?.canAddChildren === 'boolean' ? { canAddChildren: created.capabilities.canAddChildren } : {}),
  };
};

export const ensureLibraryDriveFolders = async (): Promise<LibraryDriveFolders> => {
  libraryFoldersPromise ??= Promise.all([
    findOrCreateLibraryFolder(LIBRARY_PDF_FOLDER_NAME, 'pdfs'),
    findOrCreateLibraryFolder(LIBRARY_COVER_FOLDER_NAME, 'covers'),
  ]).then(([pdfs, covers]) => ({ pdfs, covers })).catch((error) => {
    libraryFoldersPromise = undefined;
    throw error;
  });
  return libraryFoldersPromise;
};

const getLibraryFolderId = async (asset: LibraryAssetKind) => {
  const folders = await ensureLibraryDriveFolders();
  return asset === 'pdf' ? folders.pdfs.id : folders.covers.id;
};

const hasValidLibrarySignature = (bytes: Uint8Array, mimeType: string) => {
  if (mimeType === PDF_MIME_TYPE) return Buffer.from(bytes).includes(Buffer.from('%PDF-'));
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (mimeType === 'image/webp') return Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF' && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP';
  return false;
};

const validateLibraryFile = async (file: File, asset: LibraryAssetKind) => {
  if (asset === 'pdf') {
    if (file.type !== PDF_MIME_TYPE || !/\.pdf$/i.test(file.name) || file.size > LIBRARY_FILE_LIMITS.pdf) {
      throw new Error('El PDF debe usar application/pdf, extensión .pdf y pesar máximo 100 MB.');
    }
  } else if (!COVER_MIME_TYPES.has(file.type) || file.size > LIBRARY_FILE_LIMITS.cover) {
    throw new Error('La portada debe ser JPG, PNG o WebP y pesar máximo 8 MB.');
  }
  const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!hasValidLibrarySignature(prefix, file.type)) throw new Error('La firma binaria del archivo no coincide con su MIME permitido.');
};

const verifyDriveFileSignature = async (fileId: string, mimeType: string) => {
  const { drive } = getDriveContext();
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream', headers: { Range: 'bytes=0-1023' } },
  );
  const stream = response.data as unknown as Readable;
  let prefix = Buffer.alloc(0);
  for await (const chunk of stream) {
    prefix = Buffer.concat([prefix, Buffer.from(chunk as Uint8Array)]).subarray(0, 1024);
    if (prefix.length >= (mimeType === PDF_MIME_TYPE ? 1024 : 12)) { stream.destroy(); break; }
  }
  if (!hasValidLibrarySignature(prefix, mimeType)) throw new Error('La firma binaria del archivo de Drive no coincide con su MIME permitido.');
};

const uploadLibraryFile = async (file: File, asset: LibraryAssetKind): Promise<DriveUploadResult> => {
  await validateLibraryFile(file, asset);
  const { drive } = getDriveContext();
  const parentId = await getLibraryFolderId(asset);
  const extension = asset === 'pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const stem = sanitizeDriveName(file.name.replace(/\.[^.]+$/, ''));
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: `${stem}-${crypto.randomUUID()}.${extension}`, mimeType: file.type, parents: [parentId] },
    media: { mimeType: file.type, body: Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]) },
    fields: 'id,name,mimeType,parents,webViewLink,webContentLink,driveId,size',
  });
  const uploaded = toDriveUploadResult(data);
  if (!uploaded.parents.includes(parentId)) {
    await deleteDriveFile(uploaded.id);
    throw new Error('Google Drive no confirmó la subcarpeta de Biblioteca.');
  }
  return uploaded;
};

export const uploadLibraryPdf = async (file: File) => uploadLibraryFile(file, 'pdf');
export const uploadLibraryCover = async (file: File) => uploadLibraryFile(file, 'cover');

export const getConfiguredDriveFolderId = () => getRequiredEnvironmentVariable('GOOGLE_DRIVE_FOLDER_ID');

export const verifyDriveFolderAccess = async (): Promise<SafeDriveFolder> => {
  const { drive, folderId } = getDriveContext();
  const { data } = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: 'id,name,mimeType,driveId,capabilities(canAddChildren)',
  });

  if (data.mimeType !== DRIVE_FOLDER_MIME_TYPE) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID no corresponde a una carpeta de Google Drive.');
  }

  return {
    id: requireStringField(data.id, 'id'),
    name: requireStringField(data.name, 'name'),
    mimeType: data.mimeType,
    ...(data.driveId ? { driveId: data.driveId } : {}),
    ...(typeof data.capabilities?.canAddChildren === 'boolean'
      ? { canAddChildren: data.capabilities.canAddChildren }
      : {}),
  };
};

export const uploadDriveTestFile = async (): Promise<SafeDriveTestFile> => {
  const { drive, folderId } = getDriveContext();
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: TEST_FILE_NAME,
      mimeType: 'text/plain',
      parents: [folderId],
    },
    media: {
      mimeType: 'text/plain; charset=utf-8',
      body: Readable.from([TEST_FILE_CONTENT]),
    },
    fields: 'id,name,mimeType,parents,webViewLink,driveId',
  });

  return {
    id: requireStringField(data.id, 'id'),
    name: requireStringField(data.name, 'name'),
    mimeType: requireStringField(data.mimeType, 'mimeType'),
    parents: data.parents ?? [],
    ...(data.webViewLink ? { webViewLink: data.webViewLink } : {}),
    ...(data.driveId ? { driveId: data.driveId } : {}),
  };
};

export const uploadDriveFile = async (file: File, name: string): Promise<DriveUploadResult> => {
  const { drive, folderId } = getDriveContext();
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: file.type,
      parents: [folderId],
    },
    media: { mimeType: file.type, body: Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]) },
    fields: 'id,name,mimeType,parents,webViewLink,webContentLink,driveId,size',
  });

  const parents = data.parents ?? [];
  if (!parents.includes(folderId)) {
    if (data.id) await drive.files.delete({ fileId: data.id, supportsAllDrives: true });
    throw new Error('Google Drive no confirmó la carpeta padre del archivo subido.');
  }

  return {
    id: requireStringField(data.id, 'id'),
    name: requireStringField(data.name, 'name'),
    mimeType: requireStringField(data.mimeType, 'mimeType'),
    parents,
    ...(data.webViewLink ? { webViewLink: data.webViewLink } : {}),
    ...(data.webContentLink ? { webContentLink: data.webContentLink } : {}),
    ...(data.driveId ? { driveId: data.driveId } : {}),
    ...(data.size ? { size: Number(data.size) } : {}),
  };
};

export const getDriveFileMetadata = async (fileId: string): Promise<DriveUploadResult> => {
  const { drive } = getDriveContext();
  const { data } = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id,name,mimeType,parents,webViewLink,webContentLink,driveId,size',
  });
  return toDriveUploadResult(data);
};

export const verifyFileBelongsToLibraryFolder = async (fileId: string, expectedAsset?: LibraryAssetKind): Promise<DriveUploadResult> => {
  const metadata = await getDriveFileMetadata(fileId);
  const folders = await ensureLibraryDriveFolders();
  const allowedParents = expectedAsset === 'pdf'
    ? [folders.pdfs.id]
    : expectedAsset === 'cover'
      ? [folders.covers.id]
      : [folders.pdfs.id, folders.covers.id];
  if (!metadata.parents.some((parent) => allowedParents.includes(parent))) {
    throw new Error('El archivo no pertenece a las subcarpetas administradas de Biblioteca.');
  }
  return metadata;
};

export const verifyBrowserLibraryUpload = async (fileId: string, asset: LibraryAssetKind): Promise<DriveUploadResult> => {
  const { drive } = getDriveContext();
  const { data } = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id,name,mimeType,parents,webViewLink,webContentLink,driveId,size,appProperties',
  });
  if (data.appProperties?.indutechLibraryUpload !== 'browser') {
    throw new Error('El archivo no fue creado por el flujo autorizado de Biblioteca.');
  }
  const metadata = toDriveUploadResult(data);
  const verifiedParent = await verifyFileBelongsToLibraryFolder(metadata.id, asset);
  validateManagedDriveFileMetadata(asset, verifiedParent);
  await verifyDriveFileSignature(verifiedParent.id, verifiedParent.mimeType);
  return verifiedParent;
};

export const getLibraryPublicLinks = (fileId: string) => ({
  viewLink: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`,
  downloadLink: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
  contentLink: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`,
});

export const makeDriveFilePublic = async (fileId: string): Promise<string> => {
  await verifyFileBelongsToLibraryFolder(fileId);
  const { drive } = getDriveContext();
  const { data } = await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: { type: 'anyone', role: 'reader', allowFileDiscovery: false },
    fields: 'id',
  });
  return requireStringField(data.id, 'permission.id');
};

export const removeDrivePublicPermission = async (fileId: string, permissionId: string): Promise<void> => {
  if (!permissionId) throw new Error('Falta el identificador del permiso público administrado.');
  await verifyFileBelongsToLibraryFolder(fileId);
  const { drive } = getDriveContext();
  try {
    const { data: permission } = await drive.permissions.get({
      fileId,
      permissionId,
      supportsAllDrives: true,
      fields: 'id,type,role',
    });
    if (permission.type !== 'anyone' || permission.role !== 'reader') {
      throw new Error('El permiso indicado no es un permiso público de solo lectura.');
    }
    await drive.permissions.delete({ fileId, permissionId, supportsAllDrives: true });
  } catch (error) {
    const driveError = error as { code?: number; response?: { status?: number } };
    if (driveError.code === 404 || driveError.response?.status === 404) return;
    throw error;
  }
};

export const replaceDriveFile = async (
  previousFileId: string,
  replacement: File,
  asset: LibraryAssetKind,
  publish = false,
): Promise<DriveUploadResult> => {
  const uploaded = asset === 'pdf' ? await uploadLibraryPdf(replacement) : await uploadLibraryCover(replacement);
  try {
    if (publish) await makeDriveFilePublic(uploaded.id);
    await deleteDriveFile(previousFileId);
    return uploaded;
  } catch (error) {
    await Promise.allSettled([deleteDriveFile(uploaded.id)]);
    throw error;
  }
};

export const downloadDriveFile = async (fileId: string): Promise<DriveDownloadResult> => {
  const { drive } = getDriveContext();
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  const rawData = response.data as unknown;
  const bytes = rawData instanceof ArrayBuffer
    ? new Uint8Array(rawData)
    : Buffer.isBuffer(rawData)
      ? new Uint8Array(rawData)
      : new Uint8Array(rawData as ArrayBufferLike);
  const headers = response.headers as unknown as { get?: (name: string) => string | null; [key: string]: unknown };
  const readHeader = (name: string) => headers.get?.(name) ?? (typeof headers[name] === 'string' ? headers[name] : undefined);

  return {
    bytes,
    contentType: readHeader('content-type') ?? 'application/octet-stream',
    ...(readHeader('content-length') ? { contentLength: readHeader('content-length')! } : {}),
  };
};

export const streamDriveFile = async (fileId: string, rangeHeader?: string): Promise<DriveStreamResult> => {
  const { drive } = getDriveContext();
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    {
      responseType: 'stream',
      ...(rangeHeader ? { headers: { Range: rangeHeader } } : {}),
    },
  );
  const headers = response.headers as unknown as { get?: (name: string) => string | null; [key: string]: unknown };
  const readHeader = (name: string) => headers.get?.(name) ?? (typeof headers[name] === 'string' ? headers[name] : undefined);
  return {
    stream: Readable.toWeb(response.data as unknown as Readable) as ReadableStream<Uint8Array>,
    contentType: readHeader('content-type') ?? 'application/octet-stream',
    status: response.status ?? 200,
    ...(readHeader('content-length') ? { contentLength: readHeader('content-length')! } : {}),
    ...(readHeader('content-range') ? { contentRange: readHeader('content-range')! } : {}),
  };
};

export const deleteDriveFile = async (fileId: string): Promise<void> => {
  const { drive } = getDriveContext();
  await drive.files.delete({ fileId, supportsAllDrives: true });
};

export const deleteDriveTestFile = async (fileId: string): Promise<void> => {
  await deleteDriveFile(fileId);
};

export const verifyDriveTestFileAbsent = async (): Promise<boolean> => {
  const { drive, folderId } = getDriveContext();
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and name = '${TEST_FILE_NAME}' and trashed = false`,
    spaces: 'drive',
    pageSize: 1,
    fields: 'files(id)',
  });
  return (data.files?.length ?? 0) === 0;
};

export const getSafeGoogleDriveError = (error: unknown) => {
  const fallback = 'Google Drive rechazó la operación sin proporcionar detalles.';
  const message = error instanceof Error ? error.message.trim().slice(0, 500) : fallback;
  const appNeedsFileAuthorization = /appNotAuthorizedToFile|not granted the app.*access to the file/i.test(message);
  const invalidRefreshToken = /invalid_grant|token has been expired or revoked/i.test(message);

  return {
    message: message || fallback,
    ...(appNeedsFileAuthorization ? {
      recommendation: 'El scope drive.file no autoriza todavía esta carpeta. Autorízala una vez mediante Google Picker o crea una carpeta administrada por la aplicación.',
    } : invalidRefreshToken ? {
      recommendation: 'El refresh token no es válido o fue revocado. Ejecuta npm run drive:oauth para autorizar nuevamente.',
    } : {}),
  };
};
