-- Pre-created profiles stay private until the person claims the card.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN NOT NULL DEFAULT true;
