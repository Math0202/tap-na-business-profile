-- Persistent error log for Worker / Supabase failures
CREATE TABLE IF NOT EXISTS public.app_error_log (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'worker',
  message TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  request_path TEXT NOT NULL DEFAULT '',
  request_method TEXT NOT NULL DEFAULT '',
  http_status INTEGER,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_app_error_log_occurred ON public.app_error_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_log_source ON public.app_error_log(source);

ALTER TABLE public.app_error_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_error_log TO service_role;
