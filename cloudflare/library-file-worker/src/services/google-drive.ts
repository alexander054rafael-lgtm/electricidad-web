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
export const getAccessToken = async (env: Env): Promise<string> => {
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

export const downloadDriveFileStream = async (
  accessToken: string,
  fileId: string,
): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string | null; contentLength: string | null }> => {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Drive file download failed with status ${response.status}`);
  }

  return {
    body: response.body,
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length'),
  };
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

// Removed concat and readFixedChunks utilities to avoid unnecessary copying.
// The uploadFromR2 function now streams chunks directly from the R2 object.

// Note: The CHUNK_SIZE constant remains for potential future use, but we now
// send each chunk as received from the R2 stream.


// ── Resumable upload ───────────────────────────────────────────────
// Updated uploadFromR2 to stream chunks directly without concat
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

  // Counters for bytes read from R2 and bytes confirmed by Drive
  let totalReadBytes = 0;
  let uploadedBytes = 0;

  // Pre‑allocated buffer for full‑size chunks (8 MiB). Reused to keep memory low.
  const chunkBuffer = new Uint8Array(CHUNK_SIZE);
  let bufferOffset = 0; // bytes currently stored in chunkBuffer
  let chunkIndex = 0;
  const startTime = Date.now();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const fragment = value as Uint8Array;
      totalReadBytes += fragment.byteLength;

      if (totalReadBytes > fileSize) {
        throw new Error(
          `R2 stream exceeded declared size: read ${totalReadBytes} bytes, expected ${fileSize}`,
        );
      }

      // Copy fragment into reusable buffer, uploading full chunks when ready.
      let srcPos = 0;
      while (srcPos < fragment.byteLength) {
        const space = CHUNK_SIZE - bufferOffset;
        const copyLen = Math.min(space, fragment.byteLength - srcPos);
        chunkBuffer.set(fragment.subarray(srcPos, srcPos + copyLen), bufferOffset);
        bufferOffset += copyLen;
        srcPos += copyLen;

        if (bufferOffset === CHUNK_SIZE) {
          const startByte = uploadedBytes;
          const endByte = uploadedBytes + CHUNK_SIZE - 1;
          const contentRange = `bytes ${startByte}-${endByte}/${fileSize}`;
          const chunkStart = Date.now();
          const resp = await fetch(sessionUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(CHUNK_SIZE),
              'Content-Range': contentRange,
            },
            body: chunkBuffer,
          });
          const duration = Date.now() - chunkStart;
          console.debug(
            `Chunk #${chunkIndex} sent ${startByte}-${endByte} (${CHUNK_SIZE} B) -> ${resp.status} in ${duration}ms`,
          );

          if (resp.status === 308) {
            const rangeHeader = resp.headers.get('Range');
            const expectedEnd = endByte;
            if (rangeHeader) {
              const match = rangeHeader.match(/bytes=0-(\d+)/);
              const lastByte = match ? parseInt(match[1], 10) : null;
              if (lastByte !== expectedEnd) {
                throw new Error(
                  `Drive 308 Range mismatch: got ${rangeHeader}, expected bytes=0-${expectedEnd}`,
                );
              }
            }
            uploadedBytes += CHUNK_SIZE;
          } else if (resp.status === 200 || resp.status === 201) {
            uploadedBytes += CHUNK_SIZE;
            if (uploadedBytes === fileSize && totalReadBytes === fileSize) {
              return (await resp.json()) as DriveFileMetadata;
            }
            if (uploadedBytes === fileSize && totalReadBytes !== fileSize) {
              throw new Error(
                `Drive completed prematurely after ${uploadedBytes} of ${fileSize} bytes`,
              );
            }
          } else {
            const txt = await resp.text().catch(() => 'unknown');
            throw new Error(
              `Drive resumable upload failed at byte ${uploadedBytes}: ${resp.status} ${txt}`,
            );
          }
          // Reset for next chunk
          bufferOffset = 0;
          chunkIndex++;
        }
      }
    }

    // Validate total bytes read after stream ends
    if (totalReadBytes < fileSize) {
      throw new Error(
        `R2 stream ended early: read ${totalReadBytes} bytes, expected ${fileSize}`,
      );
    }

    // Send final partial chunk if any
    if (bufferOffset > 0) {
      const startByte = uploadedBytes;
      const endByte = uploadedBytes + bufferOffset - 1;
      const contentRange = `bytes ${startByte}-${endByte}/${fileSize}`;
      const resp = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(bufferOffset),
          'Content-Range': contentRange,
        },
        body: chunkBuffer.subarray(0, bufferOffset),
      });
      if (resp.status === 200 || resp.status === 201) {
        return (await resp.json()) as DriveFileMetadata;
      }
      const errorText = await resp.text().catch(() => 'unknown');
      throw new Error(`Drive resumable upload finalization failed: ${resp.status} ${errorText}`);
    }
    throw new Error(`Drive resumable upload ended without confirmation after uploading ${uploadedBytes} of ${fileSize} bytes`);
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

// ── Permissions ───────────────────────────────────────────────────
export const makeDriveFilePublic = async (
  env: Env,
  fileId: string,
): Promise<string> => {
  const accessToken = await getAccessToken(env);
  const response = await fetch(`${DRIVE_API}/files/${fileId}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'anyone',
      role: 'reader',
      allowFileDiscovery: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to make Drive file ${fileId} public: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { id: string };
  if (!data || !data.id) {
    throw new Error(`Google Drive permissions response missing id for file ${fileId}`);
  }
  return data.id;
};

