const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const RESUMABLE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const CHUNK_SIZE = 2 * 1024 * 1024;

type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => TokenClient } } };

export type BrowserDriveUploadProgress = {
  sentBytes: number;
  totalBytes: number;
  percent: number;
};

export type BrowserDriveUploadedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parents: string[];
};

let gisLoadPromise: Promise<GoogleIdentity> | undefined;

const getGoogleClientId = () => {
  const clientId = import.meta.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) throw new Error('Falta PUBLIC_GOOGLE_OAUTH_CLIENT_ID para conectar Google Drive.');
  return clientId;
};

const loadGoogleIdentity = () => {
  gisLoadPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = (window as Window & { google?: GoogleIdentity }).google;
    if (existing?.accounts?.oauth2) return resolve(existing);
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as Window & { google?: GoogleIdentity }).google;
      if (google?.accounts?.oauth2) resolve(google);
      else reject(new Error('Google Identity Services no se pudo inicializar.'));
    };
    script.onerror = () => reject(new Error('No fue posible cargar Google Identity Services.'));
    document.head.append(script);
  });
  return gisLoadPromise;
};

export const requestGoogleDriveAccessToken = async (prompt = ''): Promise<string> => {
  const google = await loadGoogleIdentity();
  const clientId = getGoogleClientId();
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error === 'access_denied' ? 'Se canceló la autorización de Google Drive.' : 'No fue posible autorizar Google Drive.'));
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt });
  });
};

const sanitizeBrowserFileName = (name: string, fallback: string) => {
  const value = name.normalize('NFKC').replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '-').replace(/\.{2,}/g, '.').replace(/^\.+/, '').trim();
  return value.slice(0, 180) || fallback;
};

const retryAfter = async (attempt: number, signal?: AbortSignal) => {
  const delay = Math.min(1_000 * 2 ** attempt, 8_000);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, delay);
    signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Upload cancelled', 'AbortError')); }, { once: true });
  });
};

const responseError = async (response: Response, fallback: string) => {
  if (response.status === 401) return new Error('GOOGLE_TOKEN_EXPIRED');
  if (response.status === 404 || response.status === 410) return new Error('GOOGLE_UPLOAD_SESSION_EXPIRED');
  return new Error(fallback);
};

export const verifyBrowserDriveAccess = async (folderIds: string[], accessToken: string, signal?: AbortSignal) => {
  for (const folderId of folderIds) {
    const response = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?fields=id,mimeType`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal,
    });
    if (!response.ok) throw new Error('Autoriza la cuenta de Google propietaria de la carpeta InduTech - Biblioteca.');
  }
};

const startResumableSession = async (file: File, parentId: string, accessToken: string, signal?: AbortSignal) => {
  const response = await fetch(RESUMABLE_UPLOAD_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type,
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({
      name: sanitizeBrowserFileName(file.name, file.type === 'application/pdf' ? 'documento.pdf' : 'portada'),
      mimeType: file.type,
      parents: [parentId],
      appProperties: { indutechLibraryUpload: 'browser' },
    }),
  });
  if (!response.ok) throw await responseError(response, 'No se pudo iniciar la subida a Google Drive.');
  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive no devolvió una sesión de subida.');
  return uploadUrl;
};

export const uploadFileDirectToGoogleDrive = async ({
  file,
  parentId,
  accessToken,
  renewAccessToken,
  onProgress,
  signal,
}: {
  file: File;
  parentId: string;
  accessToken: string;
  renewAccessToken: () => Promise<string>;
  onProgress: (progress: BrowserDriveUploadProgress) => void;
  signal?: AbortSignal;
}): Promise<BrowserDriveUploadedFile> => {
  let token = accessToken;
  let uploadUrl = await startResumableSession(file, parentId, token, signal);
  let offset = 0;
  let sessionRestarts = 0;
  let retries = 0;
  onProgress({ sentBytes: 0, totalBytes: file.size, percent: 0 });

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type,
          'Content-Length': String(chunk.size),
          'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (retries >= 3) throw new Error('La conexión con Google Drive falló durante la subida.');
      await retryAfter(retries++, signal);
      continue;
    }

    if (response.status === 308) {
      offset = end;
      retries = 0;
      onProgress({ sentBytes: offset, totalBytes: file.size, percent: Math.round((offset / file.size) * 100) });
      continue;
    }
    if (response.status === 200 || response.status === 201) {
      const result = await response.json() as Partial<BrowserDriveUploadedFile>;
      if (!result.id || !result.name || !result.mimeType) throw new Error('Google Drive no confirmó el archivo subido.');
      onProgress({ sentBytes: file.size, totalBytes: file.size, percent: 100 });
      return { id: result.id, name: result.name, mimeType: result.mimeType, size: Number(result.size ?? file.size), parents: result.parents ?? [parentId] };
    }
    if (response.status === 401) {
      token = await renewAccessToken();
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      if (sessionRestarts >= 1) throw new Error('La sesión de subida de Google Drive expiró. Intenta nuevamente.');
      uploadUrl = await startResumableSession(file, parentId, token, signal);
      offset = 0;
      sessionRestarts += 1;
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (retries >= 3) throw new Error('Google Drive no pudo procesar la subida. Intenta nuevamente.');
      await retryAfter(retries++, signal);
      continue;
    }
    throw await responseError(response, 'Google Drive rechazó la subida.');
  }
  throw new Error('La subida no pudo completarse.');
};

export const formatUploadProgress = (progress: BrowserDriveUploadProgress) => `${progress.percent} % · ${(progress.sentBytes / 1024 / 1024).toFixed(1)} / ${(progress.totalBytes / 1024 / 1024).toFixed(1)} MB`;
