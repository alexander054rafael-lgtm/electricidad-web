import { adminStatus } from './routes/admin-status';
import { health } from './routes/health';
import { libraryCoverServe } from './routes/library-cover';
import { libraryResourcePublish } from './routes/library-publish';
import { libraryResourcesComplete } from './routes/library-resources';
import { syncDrive, uploadCleanup, uploadComplete, uploadInit } from './routes/uploads';
import { applyCorsHeaders, getCorsHeaders, json } from './security/cors';
import type { Env, WorkerContext } from './types/env';

const operationId = () => crypto.randomUUID();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env),
      });
    }

    const context: WorkerContext = { request, env, ctx, operationId: operationId() };
    const path = new URL(request.url).pathname;

    let response: Response;
    try {
      if (request.method === 'GET' && path === '/v1/health') {
        response = await health(context);
      } else if (request.method === 'GET' && path === '/v1/admin/library/status') {
        response = await adminStatus(context);
      } else if (request.method === 'POST' && path === '/v1/admin/library/uploads/init') {
        response = await uploadInit(context);
      } else if (request.method === 'POST' && path === '/v1/admin/library/uploads/complete') {
        response = await uploadComplete(context);
      } else if (request.method === 'POST' && path === '/v1/admin/library/uploads/cleanup') {
        response = await uploadCleanup(context);
      } else if (request.method === 'POST' && path === '/v1/admin/library/uploads/sync-drive') {
        response = await syncDrive(context);
      } else if (request.method === 'POST' && path === '/v1/admin/library/resources/complete') {
        response = await libraryResourcesComplete(context);
      } else if (request.method === 'POST' && /^\/v1\/admin\/library\/[^/]+\/publish$/.test(path)) {
        response = await libraryResourcePublish(context);
      } else if (request.method === 'GET' && /^\/v1\/library\/covers\/[^/]+$/.test(path)) {
        response = await libraryCoverServe(context);
      } else {
        response = json({ ok: false, error: 'Ruta no encontrada.', operationId: context.operationId }, 404, context);
      }
    } catch {
      response = json({ ok: false, error: 'Error interno del servidor.', operationId: context.operationId }, 500, context);
    }

    return applyCorsHeaders(response, request, env);
  },
};
