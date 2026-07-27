import type { Env } from '../types/env.js';

// ── Types ──────────────────────────────────────────────────────────
export type DriveSyncResult = {
  driveFileId: string;
  name: string;
  mimeType: string;
  size: number;
  parents: string[];
  webViewLink?: string;
  syncedAt: string;
};

type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
};

// ── Constants ──────────────────────────────────────────────────────
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SUBFOLDER_PDF = 'PDFs';
const SUBFOLDER_COVER = 'Portadas';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 388 608

// ── OAuth ──────────────────────────────────────────────────────────
const getAccessToken = async (env: Env): Promise<string> => {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth credentials are not configured.');
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Google OAuth token refresh failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as AccessTokenResponse;
  return data.access_token;
};

// ── Subfolder management ───────────────────────────────────────────
const getOrCreateSubfolder = async (
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string> => {
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
  );
  const searchUrl = `${DRIVE_API}/files?q=${query}&fields=files(id,name)&pageSize=10`;

  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchResponse.ok) {
    const searchData = (await searchResponse.json()) as { files?: DriveFileMetadata[] };
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  const createResponse = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => 'unknown');
    throw new Error(`Failed to create Drive subfolder "${folderName}": ${createResponse.status} ${errorText}`);
  }

  const created = (await createResponse.json()) as DriveFileMetadata;
  return created.id;
};

// ── Chunk accumulation ─────────────────────────────────────────────

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
};

/**
 * Reads the R2 stream and yields fixed-size chunks of exactly `chunkSize` bytes,
 * except for the final chunk which may be smaller.
 */
async function* readFixedChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunkSize: number,
): AsyncGenerator<Uint8Array> {
  let buffer = new Uint8Array(0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.length > 0) yield buffer;
      return;
    }

    // R2 stream returns Uint8Array<ArrayBufferLike>, but Workers expects
    // Uint8Array<ArrayBuffer>. The runtime types are compatible.
    // @ts-expect-error: workers Uint8Array generic differs from R2 stream
    buffer = concat(buffer, value);

    while (buffer.length >= chunkSize) {
      const chunk = buffer.slice(0, chunkSize);
      buffer = buffer.slice(chunkSize);
      yield chunk;
    }
  }
}

// ── Resumable upload ───────────────────────────────────────────────
const uploadFromR2 = async (
  env: Env,
  objectKey: string,
  mimeType: string,
  fileName: string,
  fileSize: number,
  parentFolderId: string,
  accessToken: string,
): Promise<DriveFileMetadata> => {
  const sessionUrl = await initiateResumableSession(accessToken, fileName, mimeType, parentFolderId, fileSize);

  const object = await env.LIBRARY_CACHE.get(objectKey);
  if (!object) throw new Error(`R2 object not found: ${objectKey}`);

  const body = object.body;
  if (!body) throw new Error(`R2 object has no readable body: ${objectKey}`);

  const reader = body.getReader();
  let uploadedBytes = 0;

  try {
    for await (const chunk of readFixedChunks(reader, CHUNK_SIZE)) {
      const chunkSize = chunk.byteLength;
      const startByte = uploadedBytes;
      const endByte = uploadedBytes + chunkSize - 1;
      const contentRange = `bytes ${startByte}-${endByte}/${fileSize}`;

      const chunkResponse = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunkSize),
          'Content-Range': contentRange,
        },
        // @ts-expect-error: chunk is compatible at runtime
        body: chunk,
      });

      // 200/201 → complete
      if (chunkResponse.status === 200 || chunkResponse.status === 201) {
        return (await chunkResponse.json()) as DriveFileMetadata;
      }

      // 308 → continue
      if (chunkResponse.status === 308) {
        uploadedBytes += chunkSize;
        continue;
      }

      const errorText = await chunkResponse.text().catch(() => 'unknown');
      throw new Error(
        `Drive resumable upload failed at byte ${uploadedBytes}: ${chunkResponse.status} ${errorText}`,
      );
    }

    if (uploadedBytes < fileSize) {
      const finalResponse = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': '0',
          'Content-Range': `bytes */${fileSize}`,
        },
      });

      if (finalResponse.status === 200 || finalResponse.status === 201) {
        return (await finalResponse.json()) as DriveFileMetadata;
      }

      const errorText = await finalResponse.text().catch(() => 'unknown');
      throw new Error(`Drive resumable upload finalization failed: ${finalResponse.status} ${errorText}`);
    }

    throw new Error(
      `Drive resumable upload ended without confirmation after uploading ${uploadedBytes} of ${fileSize} bytes`,
    );
  } finally {
    reader.releaseLock();
  }
};

// ── Initiate resumable session ─────────────────────────────────────
const initiateResumableSession = async (
  accessToken: string,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  fileSize: number,
): Promise<string> => {
  const response = await fetch(`${UPLOAD_API}/files?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize),
    },
    body: JSON.stringify({
      name: fileName,
      mimeType,
      parents: [parentFolderId],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to initiate Drive resumable session: ${response.status} ${errorText}`);
  }

  const location = response.headers.get('Location');
  if (!location) {
    throw new Error('Drive did not return a resumable session URL.');
  }

  return location;
};

// ── Verify uploaded file ───────────────────────────────────────────
const verifyDriveFile = async (
  accessToken: string,
  driveFileId: string,
  expectedSize: number,
  expectedMimeType: string,
): Promise<DriveFileMetadata> => {
  const response = await fetch(
    `${DRIVE_API}/files/${driveFileId}?fields=id,name,mimeType,size,parents,webViewLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Drive file verification failed: ${response.status} ${errorText}`);
  }

  const metadata = (await response.json()) as DriveFileMetadata;

  if (Number(metadata.size) !== expectedSize) {
    throw new Error(`Drive file size mismatch: expected ${expectedSize}, got ${metadata.size}`);
  }

  if (metadata.mimeType !== expectedMimeType) {
    throw new Error(`Drive file MIME type mismatch: expected ${expectedMimeType}, got ${metadata.mimeType}`);
  }

  return metadata;
};

// ── Main sync ──────────────────────────────────────────────────────
export type SyncDriveInput = {
  uploadId: string;
  objectKey: string;
  kind: 'pdf' | 'cover';
  fileName: string;
  mimeType: string;
  size: number;
};

export const syncFileToDrive = async (
  env: Env,
  input: SyncDriveInput,
): Promise<DriveSyncResult> => {
  const accessToken = await getAccessToken(env);
  const rootFolderId = env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured.');

  const subfolderName = input.kind === 'pdf' ? SUBFOLDER_PDF : SUBFOLDER_COVER;
  const subfolderId = await getOrCreateSubfolder(accessToken, rootFolderId, subfolderName);

  const uploaded = await uploadFromR2(
    env,
    input.objectKey,
    input.mimeType,
    input.fileName,
    input.size,
    subfolderId,
    accessToken,
  );

  const verified = await verifyDriveFile(accessToken, uploaded.id, input.size, input.mimeType);

  return {
    driveFileId: verified.id,
    name: verified.name,
    mimeType: verified.mimeType,
    size: Number(verified.size),
    parents: verified.parents ?? [],
    webViewLink: verified.webViewLink,
    syncedAt: new Date().toISOString(),
  };
};
