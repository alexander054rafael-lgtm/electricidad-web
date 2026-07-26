import { requireAdmin } from '../auth/admin';
import { isSupabaseConfigured } from '../auth/supabase';
import { checkR2Connection } from '../services/r2';
import { json } from '../security/cors';
import type { WorkerContext } from '../types/env';

export const adminStatus = async ({ request, env, operationId }: WorkerContext, origin?: string) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, code: auth.code, error: auth.error, operationId }, auth.status, origin);
  const r2 = await checkR2Connection(env);
  return json({
    ok: r2,
    phase: 1,
    operationId,
    worker: 'available',
    r2: r2 ? 'available' : 'unavailable',
    supabase: isSupabaseConfigured(env) ? 'configured' : 'unavailable',
    drive: 'deferred',
    failedSynchronizations: 'deferred',
    cache: 'deferred',
  }, r2 ? 200 : 503, origin);
};
