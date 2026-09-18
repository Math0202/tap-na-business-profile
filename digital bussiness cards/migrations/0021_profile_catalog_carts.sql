-- Visitor interest / quote requests from personal profile catalogs
CREATE TABLE IF NOT EXISTS public.profile_catalog_carts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL DEFAULT '',
  visitor_email TEXT NOT NULL DEFAULT '',
  visitor_phone TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'catalog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_profile_catalog_carts_profile
  ON public.profile_catalog_carts(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_catalog_carts_deleted
  ON public.profile_catalog_carts(deleted);

ALTER TABLE public.profile_catalog_carts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.profile_catalog_carts TO service_role;
