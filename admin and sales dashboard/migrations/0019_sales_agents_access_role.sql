-- Manager access role for sales agents / staff
ALTER TABLE public.sales_agents
  ADD COLUMN IF NOT EXISTS access_role TEXT NOT NULL DEFAULT 'sales';

DO $$ BEGIN
  ALTER TABLE public.sales_agents
    DROP CONSTRAINT IF EXISTS sales_agents_access_role_check;
  ALTER TABLE public.sales_agents
    ADD CONSTRAINT sales_agents_access_role_check
    CHECK (access_role = ANY (ARRAY['sales'::text, 'manager'::text]));
EXCEPTION WHEN others THEN NULL;
END $$;
