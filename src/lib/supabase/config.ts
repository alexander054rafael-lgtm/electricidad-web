export const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim() ?? '';
export const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
export const siteUrl = (import.meta.env.PUBLIC_SITE_URL?.trim() || 'http://localhost:4321').replace(/\/$/, '');

export const isSupabaseConfigured =
  /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) &&
  supabaseAnonKey.length > 30 &&
  !supabaseUrl.includes('your-project-ref') &&
  !supabaseAnonKey.includes('your-public-anon-key');
