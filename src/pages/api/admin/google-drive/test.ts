import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import {
  deleteDriveTestFile,
  getConfiguredDriveFolderId,
  getSafeGoogleDriveError,
  GoogleDriveConfigurationError,
  uploadDriveTestFile,
  verifyDriveFolderAccess,
  verifyDriveTestFileAbsent,
  type SafeDriveFolder,
} from '../../../../lib/google-drive/server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  let folder: SafeDriveFolder | undefined;
  let uploadedFileId: string | undefined;
  let uploadVerified = false;
  let cleanupVerified = false;
  let operationError: unknown;

  try {
    const configuredFolderId = getConfiguredDriveFolderId();
    folder = await verifyDriveFolderAccess();
    if (folder.id !== configuredFolderId || !folder.name) {
      throw new Error('Google Drive no confirmó el ID y nombre de la carpeta configurada.');
    }
    const uploadedFile = await uploadDriveTestFile();
    uploadedFileId = uploadedFile.id;
    uploadVerified = uploadedFile.parents.includes(configuredFolderId);

    if (!uploadVerified) {
      throw new Error('Google Drive creó el archivo, pero no confirmó la carpeta padre configurada.');
    }
  } catch (error) {
    operationError = error;
  } finally {
    if (uploadedFileId) {
      try {
        await deleteDriveTestFile(uploadedFileId);
        cleanupVerified = await verifyDriveTestFileAbsent();
        if (!cleanupVerified) {
          operationError ??= new Error('Google Drive todavía muestra un archivo temporal residual en la carpeta.');
        }
      } catch (cleanupError) {
        operationError ??= cleanupError;
      }
    }
  }

  if (operationError) {
    const safeError = getSafeGoogleDriveError(operationError);
    return json({
      ok: false,
      authMode: 'oauth-user',
      folderFound: Boolean(folder),
      uploadVerified,
      cleanupVerified,
      error: safeError.message,
      ...(safeError.recommendation ? { recommendation: safeError.recommendation } : {}),
    }, operationError instanceof GoogleDriveConfigurationError ? 503 : 502);
  }

  return json({
    ok: true,
    authMode: 'oauth-user',
    folderFound: true,
    uploadVerified,
    cleanupVerified,
  });
};
