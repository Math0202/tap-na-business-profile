-- tap-na core schema on Supabase (Postgres)
-- Applied remotely as migration tap_na_init

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  card_type TEXT NOT NULL DEFAULT 'personal' CHECK (card_type IN ('personal', 'table')),
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  youtube TEXT NOT NULL DEFAULT '',
  x TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  tiktok TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  menu_url TEXT NOT NULL DEFAULT '',
  google_review TEXT NOT NULL DEFAULT '',
  check_in_url TEXT NOT NULL DEFAULT '',
  feedback_url TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  video TEXT NOT NULL DEFAULT '',
  disabled BOOLEAN NOT NULL DEFAULT false,
  login_email TEXT NOT NULL DEFAULT '',
  login_phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'other',
  product_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unlinked' CHECK (status IN ('unlinked', 'linked', 'disabled')),
  profile_id TEXT REFERENCES public.profiles(id),
  sale_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cards_slug ON public.cards(slug);
CREATE INDEX IF NOT EXISTS idx_cards_profile ON public.cards(profile_id);

CREATE TABLE IF NOT EXISTS public.card_opens (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES public.cards(id),
  slug TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'nfc' CHECK (channel IN ('nfc', 'qr', 'other')),
  user_agent TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  ip_country TEXT NOT NULL DEFAULT '',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opens_card ON public.card_opens(card_id);
CREATE INDEX IF NOT EXISTS idx_opens_at ON public.card_opens(opened_at);

CREATE TABLE IF NOT EXISTS public.checkins (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id),
  venue TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT 'General visit',
  guests INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_profile ON public.checkins(profile_id);

CREATE TABLE IF NOT EXISTS public.feedback (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id),
  venue TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_profile ON public.feedback(profile_id);

CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_opens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
