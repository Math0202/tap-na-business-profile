-- Enforce: table/business profiles may only have one linked card slug
create or replace function public.enforce_one_linked_card_per_table_profile()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id is null or new.status is distinct from 'linked' then
    return new;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.card_type = 'table'
  ) and exists (
    select 1
    from public.cards c
    where c.profile_id = new.profile_id
      and c.status = 'linked'
      and c.id is distinct from new.id
  ) then
    raise exception 'Business profiles can only link one card'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_one_linked_card_per_table_profile on public.cards;

create trigger trg_one_linked_card_per_table_profile
before insert or update of profile_id, status
on public.cards
for each row
execute function public.enforce_one_linked_card_per_table_profile();
