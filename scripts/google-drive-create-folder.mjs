import { existsSync } from 'node:fs';
import { google } from 'googleapis';

const FOLDER_NAME = 'InduTech - Biblioteca';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const RESPONSE_FIELDS = 'id,name,mimeType,parents,webViewLink';

for (const environmentFile of ['.env', '.env.local']) {
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
}

const getRequiredEnvironmentVariable = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en el entorno, .env o .env.local.`);
  return value;
};

const oauthClient = new google.auth.OAuth2(
  getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_ID'),
  getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_SECRET'),
);
oauthClient.setCredentials({
  refresh_token: getRequiredEnvironmentVariable('GOOGLE_OAUTH_REFRESH_TOKEN'),
});

const drive = google.drive({ version: 'v3', auth: oauthClient });
const { data: folderSearch } = await drive.files.list({
  q: `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
  spaces: 'drive',
  pageSize: 10,
  orderBy: 'createdTime',
  fields: `files(${RESPONSE_FIELDS})`,
});

let folder = folderSearch.files?.[0];
if (!folder) {
  const { data } = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE,
    },
    fields: RESPONSE_FIELDS,
  });
  folder = data;
}

if (!folder.id || folder.name !== FOLDER_NAME || folder.mimeType !== FOLDER_MIME_TYPE) {
  throw new Error('Google Drive no devolvió una carpeta administrada válida.');
}

console.log(`GOOGLE_DRIVE_FOLDER_ID=${folder.id}`);
