-- Align cashflow with other sales tables (soft-delete sets updated_at)
ALTER TABLE public.sales_cashflow
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
