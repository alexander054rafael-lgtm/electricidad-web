export interface Env {
  LIBRARY_CACHE: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS: string;
  MAX_PDF_BYTES: string;
  MAX_COVER_BYTES: string;
  CACHE_TARGET_BYTES: string;
  CACHE_LOW_WATERMARK_BYTES: string;
  CACHE_MAX_AGE_DAYS: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  // Phase 3 secrets: configure in Cloudflare only; they are not consumed yet.
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REFRESH_TOKEN?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
}

export type WorkerContext = {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  operationId: string;
};
