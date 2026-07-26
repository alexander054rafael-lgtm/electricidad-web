import { getAuthenticatedUserId, getBearerToken, getUserRole } from './supabase';
import type { Env } from '../types/env';

export type AdminAuth = { ok: true; userId: string } | { ok: false; status: 401 | 403 | 503; error: string };

export const requireAdmin = async (request: Request, env: Env): Promise<AdminAuth> => {
  const token = getBearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Debes iniciar sesión.' };
  const userId = await getAuthenticatedUserId(token, env);
  if (!userId) return { ok: false, status: 401, error: 'La sesión no es válida.' };
  const role = await getUserRole(userId, env);
  if (role === undefined) return { ok: false, status: 503, error: 'No se pudo verificar el perfil.' };
  if (role !== 'admin') return { ok: false, status: 403, error: 'Esta acción requiere rol de administrador.' };
  return { ok: true, userId };
};
