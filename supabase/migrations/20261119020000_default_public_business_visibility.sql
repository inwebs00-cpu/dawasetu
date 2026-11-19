-- Default approved non-distributor business listings to public availability.
-- Owners can switch visibility off later from their business profile.
-- Distributors remain private through enforce_distributor_business_privacy.

alter table public.businesses
  alter column public_availability_enabled set default true;

create or replace function public.default_public_availability_for_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.business_types bt
    where bt.id = new.business_type_id
      and not bt.is_distributor
  ) then
    new.public_availability_enabled := true;
  else
    new.public_availability_enabled := false;
  end if;

  return new;
end;
$$;

revoke all on function public.default_public_availability_for_business()
  from public, anon, authenticated;

drop trigger if exists default_public_availability_before_insert
  on public.businesses;

create trigger default_public_availability_before_insert
before insert on public.businesses
for each row
execute function public.default_public_availability_for_business();

update public.businesses b
set public_availability_enabled = true
where b.status = 'approved'
  and not b.public_availability_enabled
  and exists (
    select 1
    from public.business_types bt
    where bt.id = b.business_type_id
      and not bt.is_distributor
  );
