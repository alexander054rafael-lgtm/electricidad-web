import type { Env } from '../types/env';

type SupabaseUser = { id?: unknown };
type Profile = { role?: unknown };

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

export const getAuthenticatedUserId = async (token: string, env: Env): Promise<string | undefined> => {
  if (!configured(env)) return undefined;
  const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!response.ok) return undefined;
  const user = await response.json() as SupabaseUser;
  return typeof user.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : undefined;
};

export const getUserRole = async (userId: string, env: Env): Promise<string | undefined> => {
  if (!configured(env)) return undefined;
  const response = await fetch(`${supabaseUrl(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) return undefined;
  const profiles = await response.json() as Profile[];
  return typeof profiles[0]?.role === 'string' ? profiles[0].role : undefined;
};

export const isSupabaseConfigured = configured;
