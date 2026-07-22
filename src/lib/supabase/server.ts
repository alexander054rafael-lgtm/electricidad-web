import { createServerClient } from '@supabase/ssr';
import type { APIContext } from 'astro';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './config';

type ServerContext = Pick<APIContext, 'cookies' | 'request'>;

export const createSupabaseServerClient = ({ cookies, request }: ServerContext) => {
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
