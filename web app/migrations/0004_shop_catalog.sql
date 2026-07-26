-- Shop catalog: products table + public shop storage bucket
-- Applied remotely as migration shop_catalog

CREATE TABLE IF NOT EXISTS public.shop_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL CHECK (section IN ('business-cards', 'table-brochure')),
  badge TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_section ON public.shop_products(section, sort_order);

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active shop products" ON public.shop_products;
CREATE POLICY "Public read active shop products"
  ON public.shop_products
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

GRANT SELECT ON public.shop_products TO anon, authenticated;
GRANT ALL ON public.shop_products TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop',
  'shop',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read shop images" ON storage.objects;
CREATE POLICY "Public read shop images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'shop');

DROP POLICY IF EXISTS "Service write shop images" ON storage.objects;
CREATE POLICY "Service write shop images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'shop')
  WITH CHECK (bucket_id = 'shop');