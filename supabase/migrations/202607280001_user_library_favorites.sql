-- Migration: user_library_favorites table and policies
CREATE TABLE IF NOT EXISTS public.user_library_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.library_resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_library_favorites_pkey PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_favorites_user_id ON public.user_library_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_favorites_resource_id ON public.user_library_favorites(resource_id);

ALTER TABLE public.user_library_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_library_favorites;
CREATE POLICY "Users can view their own favorites"
  ON public.user_library_favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_library_favorites;
CREATE POLICY "Users can insert their own favorites"
  ON public.user_library_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_library_favorites;
CREATE POLICY "Users can delete their own favorites"
  ON public.user_library_favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_library_favorites TO authenticated;
