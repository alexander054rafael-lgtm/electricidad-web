-- Migration: Add display_slug column to public.library_resources
-- Idempotent column addition and backfill for existing rows

ALTER TABLE public.library_resources
ADD COLUMN IF NOT EXISTS display_slug text;

-- Backfill display_slug for existing rows where display_slug is null
UPDATE public.library_resources
SET display_slug = slug
WHERE display_slug IS NULL;
