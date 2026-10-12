create or replace function public.service_record_medicine_searches(
  p_medicine_ids uuid[],
  p_visitor_hashes text[]
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inserted integer;
begin
  if p_medicine_ids is null or p_visitor_hashes is null
    or cardinality(p_medicine_ids) not between 1 and 30
    or cardinality(p_medicine_ids) <> cardinality(p_visitor_hashes)
    or exists (select 1 from unnest(p_visitor_hashes) h where h !~ '^[0-9a-f]{64}$')
  then
    return 0;
  end if;

  with requested as (
    select distinct medicine_id, visitor_hash
    from unnest(p_medicine_ids, p_visitor_hashes) as item(medicine_id, visitor_hash)
    where medicine_id is not null
  ), visible as (
    select r.medicine_id, r.visitor_hash
    from requested r
    join public.medicines m on m.id = r.medicine_id
      and m.status = 'approved' and m.public_visibility
    where exists (
      select 1
      from public.inventory i
      join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
      join public.businesses b on b.id = i.business_id
        and b.status = 'approved' and b.public_availability_enabled
      join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
      where i.medicine_id = m.id and i.status in ('available', 'low_stock')
    )
  )
  insert into public.medicine_search_events(medicine_id, visitor_hash, searched_on)
  select medicine_id, visitor_hash, current_date from visible
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.service_record_medicine_searches(uuid[], text[]) from public, anon, authenticated;
grant execute on function public.service_record_medicine_searches(uuid[], text[]) to service_role;
