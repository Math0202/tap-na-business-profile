-- Personal business-card meetings & follow-ups
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_booking boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.meetings (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  preferred_at timestamptz,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new'
    CHECK (status = ANY (ARRAY['new'::text, 'confirmed'::text, 'done'::text, 'cancelled'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_profile_id_created_at_idx
  ON public.meetings (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.followups (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_id text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open'::text, 'done'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS followups_profile_id_due_at_idx
  ON public.followups (profile_id, due_at ASC NULLS LAST);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.meetings TO service_role;
GRANT ALL ON TABLE public.followups TO service_role;
