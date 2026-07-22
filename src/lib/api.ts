import type { APIContext } from 'astro';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

export const internalApiError = (
  scope: string,
  error: unknown,
  message = 'No se pudo completar la operaci\u00f3n.',
  status = 500,
) => {
  if (import.meta.env.DEV) console.error(`[${scope}]`, error);
  return json({ error: message }, status);
};

type ApiAuth = { ok: false; response: Response } | { ok: true; supabase: SupabaseClient; user: User };

export const requireApiUser = (context: APIContext): ApiAuth => {
  if (!context.locals.supabase) {
    return { ok: false, response: json({ error: 'El servicio no est\u00e1 disponible temporalmente.' }, 503) };
  }
  if (!context.locals.user) {
    return { ok: false, response: json({ error: 'Debes iniciar sesi\u00f3n.' }, 401) };
  }
  return { ok: true, supabase: context.locals.supabase, user: context.locals.user };
};

export const requireApiStaff = (context: APIContext): ApiAuth => {
  const auth = requireApiUser(context);
  if (!auth.ok) return auth;
  if (!['instructor', 'admin'].includes(context.locals.role)) {
    return { ok: false, response: json({ error: 'No tienes permisos para administrar contenido.' }, 403) };
  }
  return auth;
};

export const requireApiAdmin = (context: APIContext): ApiAuth => {
  const auth = requireApiUser(context);
  if (!auth.ok) return auth;
  const { profile, role } = context.locals;
  if (!profile || role !== 'admin' || profile.role !== 'admin') {
    return { ok: false, response: json({ error: 'Esta acci\u00f3n requiere rol de administrador.' }, 403) };
  }
  return auth;
};

export const readRequestData = async (request: Request) => {
  if (request.headers.get('content-type')?.includes('application/json')) {
    return await request.json() as Record<string, unknown>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
};
