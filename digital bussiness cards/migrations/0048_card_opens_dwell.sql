-- Dwell / session fields for UX journey analytics on public profile visits
alter table public.card_opens add column if not exists dwell_ms integer;
alter table public.card_opens add column if not exists session_key text not null default '';

create index if not exists idx_opens_session_key
  on public.card_opens(session_key)
  where session_key <> '';

create index if not exists idx_opens_dwell
  on public.card_opens(dwell_ms)
  where dwell_ms is not null;