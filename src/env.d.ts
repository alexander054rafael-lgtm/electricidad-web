/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
  type AppRole = 'visitor' | 'student' | 'instructor' | 'admin';
  namespace App {
    interface Locals {
      supabase: SupabaseClient | null;
      user: User | null;
      profile: { id: string; full_name: string | null; avatar_url: string | null; role: AppRole } | null;
      role: AppRole;
    }
  }
  interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL?: string;
    readonly PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly PUBLIC_SITE_URL?: string;
  }

  interface ImportMeta { readonly env: ImportMetaEnv }
}

export {};
