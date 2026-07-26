import type { Env } from '../types/env';

export const checkR2Connection = async (env: Env) => {
  try {
    await env.LIBRARY_CACHE.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
};
