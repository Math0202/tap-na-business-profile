-- Allow team owners to share meeting calendar tool and CRM settings with team members
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS share_calendar_crm BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.share_calendar_crm IS
  'When true, active team members inherit team calendar tool and CRM integrations.';
