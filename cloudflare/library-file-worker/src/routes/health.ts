import { checkR2Connection } from '../services/r2';
import { json } from '../security/cors';
import type { WorkerContext } from '../types/env';

export const health = async (context: WorkerContext) => {
  const r2 = await checkR2Connection(context.env);
  return json(
    { ok: r2, service: 'library-file-worker', phase: 1, operationId: context.operationId, r2: r2 ? 'available' : 'unavailable' },
    r2 ? 200 : 503,
    context
  );
};
