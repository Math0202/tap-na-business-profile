-- Personal card tiers + teams for personal profiles
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS personal_type TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.cards.personal_type IS
  'For personal cards: executive_exclusive | business | professional. Empty for table cards.';

CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  owner_profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_teams_deleted ON public.teams(deleted);

CREATE TABLE IF NOT EXISTS public.team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  card_id TEXT REFERENCES public.cards(id) ON DELETE SET NULL,
  slug TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'professional',
  status TEXT NOT NULL DEFAULT 'pending_claim',
  invite_email TEXT NOT NULL DEFAULT '',
  invited_by_profile_id TEXT NOT NULL DEFAULT '',
  invite_token TEXT NOT NULL DEFAULT '',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON public.team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_team_members_card ON public.team_members(card_id);
CREATE INDEX IF NOT EXISTS idx_team_members_slug ON public.team_members(slug);
CREATE INDEX IF NOT EXISTS idx_team_members_deleted ON public.team_members(deleted);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.teams TO service_role;
GRANT ALL ON TABLE public.team_members TO service_role;
