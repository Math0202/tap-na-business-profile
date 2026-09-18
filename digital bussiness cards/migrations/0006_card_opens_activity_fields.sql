-- Enrich card opens for admin activity timeline
alter table public.card_opens add column if not exists action text not null default 'open';
alter table public.card_opens add column if not exists ip_city text not null default '';
alter table public.card_opens add column if not exists ip_region text not null default '';
create index if not exists idx_opens_slug_at on public.card_opens(slug, opened_at desc);
create index if not exists idx_opens_action on public.card_opens(action);
