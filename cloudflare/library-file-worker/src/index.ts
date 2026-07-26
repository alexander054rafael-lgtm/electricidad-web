import { adminStatus } from './routes/admin-status';
import { health } from './routes/health';
import { syncDrive, uploadCleanup, uploadComplete, uploadInit } from './routes/uploads';
import { corsHeaders, getAllowedOrigin, json } from './security/cors';
import type { Env, WorkerContext } from './types/env';

const operationId = () => crypto.randomUUID();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = getAllowedOrigin(request, env);
    if (request.headers.has('origin') && !origin) return json({ ok: false, error: 'Origen no permitido.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });

    const context: WorkerContext = { request, env, ctx, operationId: operationId() };
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/v1/health') return health(context, origin);
    if (request.method === 'GET' && path === '/v1/admin/library/status') return adminStatus(context, origin);
    if (request.method === 'POST' && path === '/v1/admin/library/uploads/init') return await uploadInit(context, origin);
    if (request.method === 'POST' && path === '/v1/admin/library/uploads/complete') return await uploadComplete(context, origin);
    if (request.method === 'POST' && path === '/v1/admin/library/uploads/cleanup') return await uploadCleanup(context, origin);
    if (request.method === 'POST' && path === '/v1/admin/library/uploads/sync-drive') return await syncDrive(context, origin);
    return json({ ok: false, error: 'Ruta no encontrada.', operationId: context.operationId }, 404, origin);
  },
};
