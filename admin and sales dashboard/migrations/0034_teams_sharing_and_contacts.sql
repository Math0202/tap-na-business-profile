-- Allow team owners to share bio, banner, and contacts with active members
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS share_bio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_banner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_contacts BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.share_bio IS
  'When true, active team members show the owner profile bio on their public card unless overridden.';
COMMENT ON COLUMN public.teams.share_banner IS
  'When true, active team members show the owner profile banner on their public card unless overridden.';
COMMENT ON COLUMN public.teams.share_contacts IS
  'When true, all team members can see contacts collected across the team.';
