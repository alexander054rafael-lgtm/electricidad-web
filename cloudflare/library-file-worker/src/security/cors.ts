import type { Env, WorkerContext } from '../types/env';

const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'X-Idempotency-Key'];
const ALLOWED_HEADERS_LOWER = new Set(ALLOWED_HEADERS.map((h) => h.toLowerCase()));

/**
 * Generates CORS headers for a request based on env.ALLOWED_ORIGINS.
 */
export function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const headers = new Headers({
    'Vary': 'Origin',
  });

  const rawOrigin = request.headers.get('origin');
  if (!rawOrigin) {
    return headers;
  }

  const normalizedOrigin = rawOrigin.trim().replace(/\/+$/, '');
  const allowedOriginsStr = env?.ALLOWED_ORIGINS || '';
  const allowedSet = new Set(
    allowedOriginsStr
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );

  if (allowedSet.has(normalizedOrigin)) {
    headers.set('Access-Control-Allow-Origin', rawOrigin.trim());
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    const reqHeadersStr = request.headers.get('access-control-request-headers');
    let allowHeaders = ALLOWED_HEADERS.join(', ');

    if (reqHeadersStr) {
      const requested = reqHeadersStr.split(',').map((h) => h.trim()).filter(Boolean);
      const matched = requested.filter((h) => ALLOWED_HEADERS_LOWER.has(h.toLowerCase()));
      if (matched.length > 0) {
        const canonicalMatched = ALLOWED_HEADERS.filter((ah) =>
          matched.some((m) => m.toLowerCase() === ah.toLowerCase())
        );
        allowHeaders = canonicalMatched.join(', ');
      }
    }

    headers.set('Access-Control-Allow-Headers', allowHeaders);
    headers.set('Access-Control-Max-Age', '86400');
  }

  return headers;
}

/**
 * Merges CORS headers into an existing Response object.
 */
export function applyCorsHeaders(response: Response, request: Request, env: Env): Response {
  const corsHeaders = getCorsHeaders(request, env);
  const newHeaders = new Headers(response.headers);
  new Headers(corsHeaders).forEach((value, key) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Builds a JSON Response with default headers and CORS headers.
 */
export function json(
  body: unknown,
  status: number,
  requestOrContext?: Request | WorkerContext,
  env?: Env
): Response {
  const responseHeaders = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });

  if (requestOrContext) {
    const request = 'request' in requestOrContext ? requestOrContext.request : requestOrContext;
    const environment = 'env' in requestOrContext ? requestOrContext.env : env!;
    if (request && environment) {
      const corsHeaders = getCorsHeaders(request, environment);
      new Headers(corsHeaders).forEach((value, key) => {
        responseHeaders.set(key, value);
      });
    }
  }

  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}
