import type { Env } from '../types/env.js';

export const checkR2Connection = async (env: Env): Promise<boolean> => {
  try {
    await env.LIBRARY_CACHE.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
};
