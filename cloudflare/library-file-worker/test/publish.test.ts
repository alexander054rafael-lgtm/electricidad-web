import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import worker from '../src/index.ts';
import type { Env } from '../src/types/env.ts';

const mockEnv: Env = {
  LIBRARY_CACHE: {} as any,
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_ANON_KEY: 'mock-key',
  SUPABASE_SERVICE_ROLE_KEY: 'mock-role-key',
  ALLOWED_ORIGINS: 'https://electricidad-web-omega.vercel.app',
  MAX_PDF_BYTES: '52428800',
  MAX_COVER_BYTES: '5242880',
  CACHE_TARGET_BYTES: '1073741824',
  CACHE_LOW_WATERMARK_BYTES: '805306368',
  CACHE_MAX_AGE_DAYS: '30',
  GOOGLE_OAUTH_CLIENT_ID: 'mock-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'mock-client-secret',
  GOOGLE_OAUTH_REFRESH_TOKEN: 'mock-refresh-token',
  GOOGLE_DRIVE_FOLDER_ID: 'mock-folder-id',
};

const mockCtx: ExecutionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test('Publish Route - Unauthenticated request returns 401 and does not 404', async () => {
  const req = new Request('https://worker.dev/v1/admin/library/12345678-1234-1234-1234-123456789012/publish', {
    method: 'POST',
    headers: {
      origin: 'https://electricidad-web-omega.vercel.app',
      'content-type': 'application/json',
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);

  assert.equal(res.status, 401);
  const body = (await res.json()) as any;
  assert.equal(body.ok, false);
  assert.equal(body.code, 'invalid_user_token');
  assert.equal(body.stage, 'auth');
});

test('Publish Route - Route matches and does not hit 404 handler', async () => {
  const req = new Request('https://worker.dev/v1/admin/library/12345678-1234-1234-1234-123456789012/publish', {
    method: 'POST',
    headers: {
      origin: 'https://electricidad-web-omega.vercel.app',
      authorization: 'Bearer invalid-token',
    },
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);

  // Should hit auth check (401), not 404 route not found
  assert.notEqual(res.status, 404);
});
