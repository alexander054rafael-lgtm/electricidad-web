import { requireAdmin } from '../auth/admin';
import { isSupabaseConfigured } from '../auth/supabase';
import { checkR2Connection } from '../services/r2';
import { json } from '../security/cors';
import type { WorkerContext } from '../types/env';

export const adminStatus = async (context: WorkerContext) => {
  const auth = await requireAdmin(context.request, context.env);
  if (!auth.ok) return json({ ok: false, code: auth.code, error: auth.error, operationId: context.operationId }, auth.status, context);
  const r2 = await checkR2Connection(context.env);
  return json({
    ok: r2,
    phase: 1,
    operationId: context.operationId,
    worker: 'available',
    r2: r2 ? 'available' : 'unavailable',
    supabase: isSupabaseConfigured(context.env) ? 'configured' : 'unavailable',
    drive: 'deferred',
    failedSynchronizations: 'deferred',
    cache: 'deferred',
  }, r2 ? 200 : 503, context);
};
