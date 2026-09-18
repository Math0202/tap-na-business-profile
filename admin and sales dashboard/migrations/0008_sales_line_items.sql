-- Add multi-product line items JSON to sales orders, quotes, and invoices

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sales_quotes
  ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'::jsonb;
