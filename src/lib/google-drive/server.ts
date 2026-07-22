import { Readable } from 'node:stream';
import { google } from 'googleapis';

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const TEST_FILE_NAME = 'indutech-drive-test.txt';
const TEST_FILE_CONTENT = 'Conexión OAuth de InduTech Academy con Google Drive verificada.';

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

export class GoogleDriveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveConfigurationError';
  }
}

const getRequiredEnvironmentVariable = (name: string) => {
  const value = process.env[name]?.trim();
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

  return { drive: google.drive({ version: 'v3', auth }), folderId };
};

const requireStringField = (value: string | null | undefined, field: string) => {
  if (!value) throw new Error(`Google Drive no devolvió el campo requerido ${field}.`);
  return value;
};

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

export const deleteDriveTestFile = async (fileId: string): Promise<void> => {
  const { drive } = getDriveContext();
  await drive.files.delete({ fileId, supportsAllDrives: true });
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
