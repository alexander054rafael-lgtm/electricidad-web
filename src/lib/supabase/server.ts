import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { APIContext } from 'astro';
import { getSecret } from 'astro:env/server';
import { getSupabaseConfig } from './config';
import { shouldUseAdminFallback } from './helpers';

export { shouldUseAdminFallback };

type ServerContext = Pick<APIContext, 'cookies' | 'request'>;

export const createSupabaseServerClient = ({ cookies, request }: ServerContext) => {
  const { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } = getSupabaseConfig();
  if (!isSupabaseConfigured) return null;
  const cookieJar = new Map<string, string>();
  for (const item of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    try { cookieJar.set(name, decodeURIComponent(value)); } catch { cookieJar.set(name, value); }
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [...cookieJar].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieJar.set(name, value);
          cookies.set(name, value, { ...options, path: options.path ?? '/' } as Parameters<typeof cookies.set>[2]);
        });
      },
    },
  });
};

export const safeRedirectPath = (value: string | null, fallback = '/mi-aprendizaje') =>
  value?.startsWith('/') && !value.startsWith('//') ? value : fallback;

export const createSupabaseAdminClient = () => {
  const { supabaseUrl } = getSupabaseConfig();
  const serviceRoleKey = getSecret('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase Service Role Key o URL no están configuradas en el servidor.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
