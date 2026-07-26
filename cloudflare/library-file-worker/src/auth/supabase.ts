import type { Env } from '../types/env';

type SupabaseUser = { id?: unknown };
type Profile = { id?: unknown; role?: unknown };

export type UserLookup =
  | { ok: true; userId: string }
  | { ok: false; code: 'invalid_user_token' };

export type ProfileLookup =
  | { ok: true; role: string }
  | { ok: false; code: 'profile_query_failed' | 'profile_not_found' };

const configured = (env: Env) => Boolean(
  env.SUPABASE_URL?.startsWith('https://')
  && env.SUPABASE_ANON_KEY
  && env.SUPABASE_SERVICE_ROLE_KEY,
);

const supabaseUrl = (env: Env) => env.SUPABASE_URL.replace(/\/$/, '');

export const getBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || undefined;
};

export const getAuthenticatedUserId = async (token: string, env: Env): Promise<UserLookup> => {
  if (!configured(env)) return { ok: false, code: 'invalid_user_token' };
  try {
    const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ok: false, code: 'invalid_user_token' };
    const user = await response.json() as SupabaseUser;
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) return { ok: false, code: 'invalid_user_token' };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, code: 'invalid_user_token' };
  }
};

export const getUserRole = async (userId: string, userToken: string, env: Env): Promise<ProfileLookup> => {
  if (!configured(env)) return { ok: false, code: 'profile_query_failed' };
  try {
    const response = await fetch(`${supabaseUrl(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        // The service secret authenticates the API key only. The user's JWT
        // remains the Authorization identity so RLS evaluates that user.
        authorization: `Bearer ${userToken}`,
      },
    });
    if (!response.ok) return { ok: false, code: 'profile_query_failed' };
    const profiles = await response.json() as Profile[];
    const profile = profiles[0];
    if (!profile || profile.id !== userId || typeof profile.role !== 'string') return { ok: false, code: 'profile_not_found' };
    return { ok: true, role: profile.role };
  } catch {
    return { ok: false, code: 'profile_query_failed' };
  }
};

export const isSupabaseConfigured = configured;
