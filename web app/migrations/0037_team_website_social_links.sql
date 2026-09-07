-- Add share_website and share_social_links to team_members and teams
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS share_website BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_social_links BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.team_members.share_website IS
  'When true, this member displays the team owner website on their card.';
COMMENT ON COLUMN public.team_members.share_social_links IS
  'When true, this member inherits the team owner social media links.';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS share_website BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_social_links BOOLEAN NOT NULL DEFAULT false;
