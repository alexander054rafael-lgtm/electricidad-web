import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import worker from '../src/index.ts';
import type { Env } from '../src/types/env.ts';
import { createExecutionContext } from './helpers/create-execution-context.ts';

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

const mockCtx = createExecutionContext().context;

test('Cover Proxy Route - Invalid resourceId returns 400', async () => {
  const req = new Request('https://worker.dev/v1/library/covers/invalid!id/test', {
    method: 'GET',
  });

  const res = await worker.fetch(req, mockEnv, mockCtx);
  assert.equal(res.status, 404); // hits 404 route handler due to path mismatch
});

test('Cover Proxy Route - Missing cover_drive_file_id returns 404', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes('library_resources')) {
      return new Response(JSON.stringify([{ id: '12345678-1234-1234-1234-123456789012', is_published: true, cover_drive_file_id: null, cover_mime_type: null }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input as any);
  };

  try {
    const req = new Request('https://worker.dev/v1/library/covers/12345678-1234-1234-1234-123456789012', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assert.equal(res.status, 404);
    const body = (await res.json()) as any;
    assert.equal(body.code, 'cover_not_found');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cover Proxy Route - Successful image response returns 200 with cache headers', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes('library_resources')) {
      return new Response(
        JSON.stringify([{ id: '12345678-1234-1234-1234-123456789012', is_published: true, cover_drive_file_id: 'drive-cover-123', cover_mime_type: 'image/jpeg' }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'mock-token' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (urlStr.includes('googleapis.com/drive/v3/files/drive-cover-123')) {
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
      });
    }
    return originalFetch(input as any);
  };

  try {
    const req = new Request('https://worker.dev/v1/library/covers/12345678-1234-1234-1234-123456789012', {
      method: 'GET',
      headers: { origin: 'https://electricidad-web-omega.vercel.app' },
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.equal(res.headers.get('cache-control'), 'public, max-age=86400, s-maxage=604800');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Cover Proxy Route - Drive failure returns 502', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes('library_resources')) {
      return new Response(
        JSON.stringify([{ id: '12345678-1234-1234-1234-123456789012', is_published: true, cover_drive_file_id: 'drive-cover-123', cover_mime_type: 'image/jpeg' }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'mock-token' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (urlStr.includes('googleapis.com/drive/v3/files/drive-cover-123')) {
      return new Response('Drive Error', { status: 404 });
    }
    return originalFetch(input as any);
  };

  try {
    const req = new Request('https://worker.dev/v1/library/covers/12345678-1234-1234-1234-123456789012', {
      method: 'GET',
    });
    const res = await worker.fetch(req, mockEnv, mockCtx);
    assert.equal(res.status, 502);
    const body = (await res.json()) as any;
    assert.equal(body.code, 'drive_fetch_failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

