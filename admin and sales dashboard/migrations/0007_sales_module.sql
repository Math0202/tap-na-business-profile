-- Sales module schema: agents, products, orders, quotes, invoices, cash flow
-- Applied remotely as migration sales_module_schema

CREATE TABLE IF NOT EXISTS public.sales_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  commission_rate NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category = ANY (ARRAY['personal'::text, 'table'::text, 'other'::text])),
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  video TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  product_id TEXT REFERENCES public.sales_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  commission NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  commission_rate NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'fulfilled'::text, 'cancelled'::text])),
  payment_method TEXT NOT NULL DEFAULT 'eft'
    CHECK (payment_method = ANY (ARRAY['cash'::text, 'eft'::text, 'card'::text, 'mobile'::text, 'other'::text])),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL DEFAULT '',
  quote_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  agent_id TEXT REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  product_id TEXT REFERENCES public.sales_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'converted'::text, 'expired'::text])),
  valid_until TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  sale_id TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT '',
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  sale_id TEXT REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  quote_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  product_id TEXT REFERENCES public.sales_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'void'::text])),
  payment_method TEXT NOT NULL DEFAULT 'eft'
    CHECK (payment_method = ANY (ARRAY['cash'::text, 'eft'::text, 'card'::text, 'mobile'::text, 'other'::text])),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_cashflow (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'in' CHECK (type = ANY (ARRAY['in'::text, 'out'::text])),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category = ANY (ARRAY['sale'::text, 'commission'::text, 'refund'::text, 'expense'::text, 'stock'::text, 'salary'::text, 'other'::text])),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  method TEXT NOT NULL DEFAULT 'other'
    CHECK (method = ANY (ARRAY['cash'::text, 'eft'::text, 'card'::text, 'mobile'::text, 'other'::text])),
  description TEXT NOT NULL DEFAULT '',
  sale_id TEXT REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_agent ON public.sales_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_sold_at ON public.sales_orders(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_status ON public.sales_quotes(status);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_number ON public.sales_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON public.sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_number ON public.sales_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_sale ON public.sales_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashflow_at ON public.sales_cashflow(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_products_category ON public.sales_products(category);

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_cashflow ENABLE ROW LEVEL SECURITY;

-- Private sales data: only service_role (Worker) may access via PostgREST
GRANT ALL ON public.sales_agents TO service_role;
GRANT ALL ON public.sales_products TO service_role;
GRANT ALL ON public.sales_orders TO service_role;
GRANT ALL ON public.sales_quotes TO service_role;
GRANT ALL ON public.sales_invoices TO service_role;
GRANT ALL ON public.sales_cashflow TO service_role;

-- Optional read of active sales catalog products for authenticated admin clients later
GRANT SELECT ON public.sales_products TO authenticated;
