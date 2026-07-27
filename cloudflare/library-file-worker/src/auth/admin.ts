import { getAuthenticatedUserId, getBearerToken, getUserRole } from './supabase.js';
import type { Env } from '../types/env.js';

export type AdminAuth = { ok: true; userId: string } | {
  ok: false;
  status: 401 | 403 | 503;
  code: 'invalid_user_token' | 'profile_query_failed' | 'profile_not_found' | 'admin_role_required';
  error: string;
};

export const requireAdmin = async (request: Request, env: Env): Promise<AdminAuth> => {
  const token = getBearerToken(request);
  if (!token) return { ok: false, status: 401, code: 'invalid_user_token', error: 'Debes iniciar sesión.' };
  const user = await getAuthenticatedUserId(token, env);
  if (!user.ok) return { ok: false, status: 401, code: user.code, error: 'La sesión no es válida.' };
  const profile = await getUserRole(user.userId, token, env);
  if (!profile.ok) {
    return {
      ok: false,
      status: profile.code === 'profile_not_found' ? 403 : 503,
      code: profile.code,
      error: profile.code === 'profile_not_found' ? 'No se encontró un perfil para este usuario.' : 'No se pudo verificar el perfil.',
    };
  }
  if (profile.role !== 'admin') return { ok: false, status: 403, code: 'admin_role_required', error: 'Esta acción requiere rol de administrador.' };
  return { ok: true, userId: user.userId };
};
