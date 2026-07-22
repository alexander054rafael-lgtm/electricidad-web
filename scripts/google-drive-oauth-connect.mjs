import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { google } from 'googleapis';

const HOST = '127.0.0.1';
const PORT = 53682;
const CALLBACK_PATH = '/oauth2/callback';
const REDIRECT_URI = `http://${HOST}:${PORT}${CALLBACK_PATH}`;
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTHORIZATION_TIMEOUT_MS = 5 * 60 * 1000;

for (const environmentFile of ['.env', '.env.local']) {
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
}

const getRequiredEnvironmentVariable = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en el entorno, .env o .env.local.`);
  return value;
};

const clientId = getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_ID');
const clientSecret = getRequiredEnvironmentVariable('GOOGLE_OAUTH_CLIENT_SECRET');
const oauthClient = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const state = randomBytes(32).toString('hex');
const authorizationUrl = oauthClient.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [DRIVE_FILE_SCOPE],
  state,
});

const validateAuthorizationUrl = (url) => {
  const parsedUrl = new URL(url);
  const requiredParameters = ['response_type', 'client_id', 'redirect_uri', 'scope', 'state'];
  const missingParameters = requiredParameters.filter((parameter) => !parsedUrl.searchParams.get(parameter));

  if (parsedUrl.searchParams.get('response_type') !== 'code') {
    throw new Error('La URL OAuth no contiene response_type=code.');
  }
  if (missingParameters.length > 0) {
    throw new Error(`La URL OAuth no contiene los parámetros requeridos: ${missingParameters.join(', ')}.`);
  }
  if (
    parsedUrl.searchParams.get('client_id') !== clientId ||
    parsedUrl.searchParams.get('redirect_uri') !== REDIRECT_URI ||
    parsedUrl.searchParams.get('state') !== state ||
    !parsedUrl.searchParams.get('scope')?.split(' ').includes(DRIVE_FILE_SCOPE)
  ) {
    throw new Error('La URL OAuth no coincide con la configuración segura esperada.');
  }
};

const openInDefaultBrowser = (url) => {
  const browserProcess = process.platform === 'win32'
    ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true })
    : process.platform === 'darwin'
      ? spawn('open', [url], { detached: true, stdio: 'ignore' })
      : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });

  browserProcess.once('error', () => {
    console.error('No se pudo abrir el navegador automáticamente. Usa la URL completa impresa en la terminal.');
  });
  browserProcess.unref();
};

validateAuthorizationUrl(authorizationUrl);

const refreshToken = await new Promise((resolve, reject) => {
  let settled = false;
  const finish = (error, token) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    server.close(() => error ? reject(error) : resolve(token));
  };

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', REDIRECT_URI);
    if (requestUrl.pathname !== CALLBACK_PATH) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Ruta no encontrada.');
      return;
    }

    const returnedState = requestUrl.searchParams.get('state');
    const code = requestUrl.searchParams.get('code');
    const oauthError = requestUrl.searchParams.get('error');

    if (returnedState !== state) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('La validación de seguridad state no coincide.');
      finish(new Error('Google devolvió un state OAuth no válido.'));
      return;
    }

    if (oauthError || !code) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Google no completó la autorización. Puedes cerrar esta ventana.');
      finish(new Error(oauthError ? `Google OAuth respondió: ${oauthError}.` : 'Google OAuth no devolvió un código.'));
      return;
    }

    try {
      const { tokens } = await oauthClient.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error('Google no devolvió refresh_token. Revoca el acceso previo y repite el consentimiento.');
      }

      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end('<!doctype html><html lang="es"><body><h1>Autorización completada</h1><p>Vuelve a la terminal para copiar el refresh token. Ya puedes cerrar esta ventana.</p></body></html>');
      finish(undefined, tokens.refresh_token);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('No se pudo intercambiar el código OAuth. Puedes cerrar esta ventana.');
      finish(error instanceof Error ? error : new Error('Falló el intercambio de código OAuth.'));
    }
  });

  const timeout = setTimeout(() => {
    finish(new Error('La autorización OAuth superó el límite de cinco minutos.'));
  }, AUTHORIZATION_TIMEOUT_MS);

  server.on('error', (error) => finish(error));
  server.listen(PORT, HOST, () => {
    console.log(`Registra exactamente esta URI de redirección en Google Cloud: ${REDIRECT_URI}`);
    console.log('URL OAuth validada: contiene response_type=code, client_id, redirect_uri, scope y state.');
    console.log('URL completa de respaldo:');
    console.log(authorizationUrl);
    openInDefaultBrowser(authorizationUrl);
  });
});

console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
