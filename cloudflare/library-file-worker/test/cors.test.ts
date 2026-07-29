import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import worker from '../src/index.ts';
import { getCorsHeaders } from '../src/security/cors.ts';
import type { Env } from '../src/types/env.ts';
import { createExecutionContext } from './helpers/create-execution-context.ts';

const mockEnv: Env = {
  LIBRARY_CACHE: {} as any,
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_ANON_KEY: 'mock-key',
  SUPABASE_SERVICE_ROLE_KEY: 'mock-role-key',
  ALLOWED_ORIGINS: ' https://electricidad-web-omega.vercel.app/ , http://localhost:4321 ',
  MAX_PDF_BYTES: '52428800',
  MAX_COVER_BYTES: '5242880',
  CACHE_TARGET_BYTES: '1073741824',
  CACHE_LOW_WATERMARK_BYTES: '805306368',
  CACHE_MAX_AGE_DAYS: '30',
};

const mockCtx = createExecutionContext().context;

test('CORS getCorsHeaders - allowed origin returns exact origin received and standard headers', () => {
  const req = new Request('https://worker.dev/v1/health', {
    headers: { origin: 'https://electricidad-web-omega.vercel.app' },
  });
  const headers = new Headers(getCorsHeaders(req, mockEnv));

  assert.equal(headers.get('access-control-allow-origin'), 'https://electricidad-web-omega.vercel.app');
  assert.equal(headers.get('vary'), 'Origin');
  assert.equal(headers.get('access-control-allow-methods'), 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  assert.equal(headers.get('access-control-allow-headers'), 'Authorization, Content-Type, X-Idempotency-Key');
  assert.equal(headers.get('access-control-max-age'), '86400');
});

test('CORS getCorsHeaders - normalizes trailing slashes in env and matches origin', () => {
  const req = new Request('https://worker.dev/v1/health', {
    headers: { origin: 'http://localhost:4321' },
  });
  const headers = new Headers(getCorsHeaders(req, mockEnv));

  assert.equal(headers.get('access-control-allow-origin'), 'http://localhost:4321');
  assert.equal(headers.get('vary'), 'Origin');
});

test('CORS getCorsHeaders - excludes headers outside explicit whitelist from Access-Control-Request-Headers', () => {
  const req = new Request('https://worker.dev/v1/admin/library/uploads/init', {
    headers: {
      origin: 'https://electricidad-web-omega.vercel.app',
      'access-control-request-headers': 'Authorization, Content-Type, X-Custom-Evil-Header, X-Idempotency-Key',
    },
  });
  const headers = new Headers(getCorsHeaders(req, mockEnv));

  assert.equal(headers.get('access-control-allow-origin'), 'https://electricidad-web-omega.vercel.app');
  assert.equal(headers.get('access-control-allow-headers'), 'Authorization, Content-Type, X-Idempotency-Key');
  assert.doesNotMatch(headers.get('access-control-allow-headers') || '', /X-Custom-Evil-Header/i);
});

test('CORS getCorsHeaders - disallowed origin does not receive Access-Control-Allow-Origin but keeps Vary: Origin', () => {
  const req = new Request('https://worker.dev/v1/health', {
    headers: { origin: 'https://malicious-site.com' },
  });
  const headers = new Headers(getCorsHeaders(req, mockEnv));

  assert.equal(headers.get('access-control-allow-origin'), null);
  assert.equal(headers.get('vary'), 'Origin');
});

test('Worker OPTIONS preflight - returns status 204 immediately with full CORS headers without auth', async () => {
  const req = new Request('https://worker.dev/v1/admin/library/uploads/init', {
    method: 'OPTIONS',
    headers: { origin: 'https://electricidad-web-omega.vercel.app' },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://electricidad-web-omega.vercel.app');
  assert.equal(res.headers.get('vary'), 'Origin');
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  assert.equal(res.headers.get('access-control-allow-headers'), 'Authorization, Content-Type, X-Idempotency-Key');
  assert.equal(res.headers.get('access-control-max-age'), '86400');
});

test('Worker Error Responses - 401 Unauthorized retains CORS headers', async () => {
  const req = new Request('https://worker.dev/v1/admin/library/uploads/init', {
    method: 'POST',
    headers: {
      origin: 'https://electricidad-web-omega.vercel.app',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://electricidad-web-omega.vercel.app');
  assert.equal(res.headers.get('vary'), 'Origin');
  const body = (await res.json()) as any;
  assert.equal(body.ok, false);
});

test('Worker Error Responses - 404 Not Found retains CORS headers', async () => {
  const req = new Request('https://worker.dev/v1/non-existent-route', {
    method: 'GET',
    headers: { origin: 'https://electricidad-web-omega.vercel.app' },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.equal(res.status, 404);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://electricidad-web-omega.vercel.app');
  assert.equal(res.headers.get('vary'), 'Origin');
});
