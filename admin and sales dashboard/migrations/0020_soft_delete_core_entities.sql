-- Soft-delete columns for cards, profiles, followups, meetings
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NOT NULL DEFAULT '';

ALTER TABLE public.followups
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NOT NULL DEFAULT '';

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_cards_deleted ON public.cards(deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted ON public.profiles(deleted);
CREATE INDEX IF NOT EXISTS idx_followups_deleted ON public.followups(deleted);
CREATE INDEX IF NOT EXISTS idx_meetings_deleted ON public.meetings(deleted);
