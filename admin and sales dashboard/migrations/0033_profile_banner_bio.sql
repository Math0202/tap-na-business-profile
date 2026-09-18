-- Add banner and bio to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';

-- Update sales_cashflow_category_check constraint to include 'transport'
ALTER TABLE public.sales_cashflow
  DROP CONSTRAINT IF EXISTS sales_cashflow_category_check;

ALTER TABLE public.sales_cashflow
  ADD CONSTRAINT sales_cashflow_category_check
  CHECK (category = ANY (ARRAY[
    'sale'::text,
    'investment'::text,
    'tech_services'::text,
    'transport'::text,
    'commission'::text,
    'refund'::text,
    'expense'::text,
    'stock'::text,
    'salary'::text,
    'other'::text
  ]));
