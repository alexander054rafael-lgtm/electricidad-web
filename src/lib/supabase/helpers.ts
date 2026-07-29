/**
 * Pure Supabase & Database Helpers (Zero Astro dependencies).
 * Safe to import in server endpoints, Astro pages, and Node.js test scripts.
 */

/**
 * Pure helper to verify whether a Supabase error should trigger controlled admin client fallback.
 * Strictly checks for Postgres RLS permission denied error code 42501.
 */
export const shouldUseAdminFallback = (error: unknown): boolean => {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '42501'
  );
};
