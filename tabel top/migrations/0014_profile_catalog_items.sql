-- Owner offerings (products/services) on personal public cards
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catalog_items jsonb NOT NULL DEFAULT '[]'::jsonb;
