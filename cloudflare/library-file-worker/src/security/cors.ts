import type { Env } from '../types/env';

const methods = 'GET, POST, PUT, DELETE, OPTIONS';
const headers = 'Authorization, Content-Type, X-Upload-ID, X-File-Hash';

const allowedOrigins = (env: Env) => new Set(
  env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
);

export const getAllowedOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get('origin');
  return origin && allowedOrigins(env).has(origin) ? origin : undefined;
};

export const corsHeaders = (origin?: string) => {
  const result = new Headers({
    'access-control-allow-methods': methods,
    'access-control-allow-headers': headers,
    'access-control-max-age': '600',
    vary: 'Origin',
  });
  if (origin) result.set('access-control-allow-origin', origin);
  return result;
};

export const json = (body: unknown, status: number, origin?: string) => {
  const responseHeaders = corsHeaders(origin);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
};
