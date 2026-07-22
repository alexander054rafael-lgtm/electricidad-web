import type { APIRoute } from 'astro';
import { safeRedirectPath } from '../../lib/supabase/server';
export const prerender = false;
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const code = url.searchParams.get('code'); const next = safeRedirectPath(url.searchParams.get('next'));
  if (!code || !locals.supabase) return redirect('/login?error=confirmation', 303);
  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  return redirect(error ? '/login?error=confirmation' : next, 303);
};
