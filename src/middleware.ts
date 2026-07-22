import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient, safeRedirectPath } from './lib/supabase/server';

const protectedPrefixes = ['/mi-aprendizaje', '/perfil'];
const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context);
  context.locals.supabase = supabase;
  context.locals.user = null;
  context.locals.profile = null;
  context.locals.role = 'visitor';

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    context.locals.user = user;
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, role').eq('id', user.id).maybeSingle();
      if (profile) {
        context.locals.profile = profile as App.Locals['profile'];
        context.locals.role = (profile.role as App.Locals['role']) ?? 'student';
      } else {
        context.locals.role = 'student';
      }
    }
  }

  const pathname = context.url.pathname;
  const requiresUser = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (requiresUser && !context.locals.user) {
    const redirect = safeRedirectPath(`${pathname}${context.url.search}`, '/mi-aprendizaje');
    return context.redirect(`/login?redirect=${encodeURIComponent(redirect)}`, 303);
  }
  if (isAdminPath(pathname)) {
    const { user, profile, role } = context.locals;
    const requestedAdminPath = safeRedirectPath(`${pathname}${context.url.search}`, '/admin');

    if (!user) {
      return context.redirect(`/iniciar-sesion?redirect=${encodeURIComponent(requestedAdminPath)}`, 303);
    }

    // El rol se valida con el perfil recuperado por el servidor, nunca desde el cliente.
    if (!profile || role !== 'admin' || profile.role !== 'admin') {
      return context.redirect('/mi-aprendizaje?error=forbidden', 303);
    }
  }

  return next();
});
