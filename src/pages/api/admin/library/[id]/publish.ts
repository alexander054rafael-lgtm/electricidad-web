// Proxy route for publishing a library resource to the Cloudflare Worker
import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { isLibraryUuid, isSameOriginRequest } from '../../../../../lib/library/validation';

// Base URL of the Cloudflare Worker (same as used in client adapters)
const WORKER_BASE_URL = import.meta.env.PUBLIC_LIBRARY_WORKER_URL ?? 'https://indutech-library-file-worker.alexander054rafael.workers.dev';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  // Ensure request is from an authenticated admin
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  // CSRF / same‑origin protection
  if (!isSameOriginRequest(context.request, context.url))
    return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);

  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return json({ ok: false, error: 'Identificador inválido.' }, 422);

  // Get Supabase JWT to forward to the worker for auth
  const { data: sessionData, error: sessionError } = await auth.supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return json({ ok: false, error: 'No hay sesión activa.' }, 401);
  }
  const token = sessionData.session.access_token;

  const workerUrl = `${WORKER_BASE_URL}/v1/admin/library/${id}/publish`;
  console.log('[publish‑proxy] forwarding request', { resourceId: id, url: workerUrl });

  try {
    const workerResp = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });

    const contentType = workerResp.headers.get('content-type') ?? '';
    let payload: unknown;
    if (contentType.includes('application/json')) {
      payload = await workerResp.json();
    } else {
      const txt = await workerResp.text();
      payload = { raw: txt };
    }

    // Forward status and JSON body to client
    return new Response(JSON.stringify(payload), {
      status: workerResp.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[publish‑proxy] error forwarding request', { resourceId: id, error: msg });
    return json({ ok: false, error: msg, workerUrl, resourceId: id }, 502);
  }
};
