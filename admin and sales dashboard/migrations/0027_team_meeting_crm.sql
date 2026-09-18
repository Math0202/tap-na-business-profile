-- Connect Teams owner: meeting calendar tool + CRM preference
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS meeting_tool TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uses_crm BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_provider TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS crm_other TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.teams.meeting_tool IS
  'google | microsoft — chosen by Connect Teams owner at claim/onboard';
COMMENT ON COLUMN public.teams.uses_crm IS
  'Owner opted in to CRM buttons on meeting emails';
COMMENT ON COLUMN public.teams.crm_provider IS
  'salesforce | zoho | hubspot | odoo | sage | other';
COMMENT ON COLUMN public.teams.crm_other IS
  'Free-text CRM name when provider is other';
