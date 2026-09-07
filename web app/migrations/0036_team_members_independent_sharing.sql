-- Allow team owners to manage what is shared for each team member independently
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS share_catalog BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_bio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_banner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_contacts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_calendar_crm BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.team_members.share_catalog IS
  'When true, this member displays the team owner catalog on their card.';
COMMENT ON COLUMN public.team_members.share_bio IS
  'When true, this member displays the team owner bio on their card.';
COMMENT ON COLUMN public.team_members.share_banner IS
  'When true, this member displays the team owner banner on their card.';
COMMENT ON COLUMN public.team_members.share_contacts IS
  'When true, this member can view team-wide contacts.';
COMMENT ON COLUMN public.team_members.share_calendar_crm IS
  'When true, this member inherits team meeting calendar and CRM integrations.';

-- Backfill existing members to match their parent team settings
UPDATE public.team_members tm
SET
  share_catalog = t.share_catalog,
  share_bio = t.share_bio,
  share_banner = t.share_banner,
  share_contacts = t.share_contacts,
  share_calendar_crm = t.share_calendar_crm
FROM public.teams t
WHERE tm.team_id = t.id;
