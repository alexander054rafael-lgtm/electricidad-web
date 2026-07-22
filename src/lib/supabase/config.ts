import { getSecret } from 'astro:env/server';

const readEnvironmentVariable = (name: string) => getSecret(name)?.trim() ?? '';

export const getSupabaseConfig = () => {
  const supabaseUrl = readEnvironmentVariable('PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnvironmentVariable('PUBLIC_SUPABASE_ANON_KEY');
  const isSupabaseConfigured =
    /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) &&
    supabaseAnonKey.length > 30 &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-public-anon-key');

  return { supabaseUrl, supabaseAnonKey, isSupabaseConfigured };
};

export const getSiteUrl = () =>
  (readEnvironmentVariable('PUBLIC_SITE_URL') || 'http://localhost:4321').replace(/\/$/, '');
