-- Industry pack on a card slug, and optional vehicle-finance settings on the profile.

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.cards.industry IS
  'Industry pack for this slug. Empty = general. auto_dealer unlocks vehicle financing.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_finance JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.vehicle_finance IS
  'Owner-edited vehicle financing: enabled, rate, term, balloon, and applicant requirements.';
