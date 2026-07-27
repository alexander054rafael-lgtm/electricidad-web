import { supabaseUrl, supabaseAdminHeaders } from '../auth/supabase.js';
import type { Env } from '../types/env.js';

/** Helper to safely parse JSON, returns null on failure */
const safeParseJson = <T>(text: string): T | null => {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

/** Generate an internal slug using the display slug and a random 6‑character hex suffix. */
export const generateInternalSlug = (displaySlug: string): string => {
  const suffix = generateRandomSuffix();
  return `${displaySlug}-${suffix}`;
};

/** Ensure the provided slug does not already exist in `public.library_resources`.
 * Retries up to `maxAttempts` (default 10). Throws an error if a free slug cannot be found.
 */
export const ensureUniqueSlug = async (
  slug: string,
  displaySlug: string,
  env: Env,
  maxAttempts = 10,
): Promise<string> => {
  let current = slug;
  for (let i = 0; i < maxAttempts; i++) {
    const url = `${supabaseUrl(env)}/rest/v1/library_resources?slug=eq.${encodeURIComponent(
      current,
    )}&select=id`;
    const resp = await fetch(url, { headers: supabaseAdminHeaders(env) });
    if (resp.ok) {
      const txt = await resp.text().catch(() => '');
      const data = safeParseJson<{ id: string }[]>(txt);
      if (!data || data.length === 0) return current; // slug is free
    }
    // Collision – generate new suffix and try again
    current = `${displaySlug}-${generateRandomSuffix()}`;
  }
  throw new Error('slug_generation_failed');
};

/** Helper to generate a 6‑byte random hex suffix (used by generateInternalSlug). */
const generateRandomSuffix = (): string => {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};
