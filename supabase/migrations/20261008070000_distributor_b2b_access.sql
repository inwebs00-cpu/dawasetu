insert into public.permissions (permission_key, module, action, description) values
  ('distributors.view', 'distributors', 'view', 'View distributor availability after an approved business relationship.'),
  ('distributors.access.manage', 'distributors', 'manage_access', 'Approve and revoke verified partner access to distributor availability.')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key = 'distributors.view'
where r.business_id is null and r.slug = 'partner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key in ('inventory.view', 'inventory.manage', 'distributors.access.manage')
where r.business_id is null and r.slug = 'distributor'
on conflict do nothing;

create table public.distributor_partner_access (
  id uuid primary key default gen_random_uuid(),
  distributor_business_id uuid not null references public.businesses(id) on delete cascade,
  partner_business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  requested_by uuid not null references public.users(id) on delete restrict,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distributor_business_id, partner_business_id),
  check (distributor_business_id <> partner_business_id)
);

create index distributor_access_partner_status_idx on public.distributor_partner_access(partner_business_id, status, updated_at desc);
create index distributor_access_distributor_status_idx on public.distributor_partner_access(distributor_business_id, status, updated_at desc);
alter table public.distributor_partner_access enable row level security;
revoke all on public.distributor_partner_access from anon, authenticated;

create trigger set_updated_at_distributor_partner_access
before update on public.distributor_partner_access
for each row execute function public.set_updated_at();

create or replace function public.enforce_distributor_business_privacy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.business_types bt where bt.id = new.business_type_id and bt.is_distributor) then
    new.public_availability_enabled := false;
  end if;
  return new;
end;
$$;
create trigger enforce_distributor_business_privacy_before_write
before insert or update of business_type_id, public_availability_enabled on public.businesses
for each row execute function public.enforce_distributor_business_privacy();
update public.businesses b set public_availability_enabled = false
where b.public_availability_enabled and exists (select 1 from public.business_types bt where bt.id = b.business_type_id and bt.is_distributor);

create or replace function public.assign_business_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_distributor boolean;
  v_role_id uuid;
begin
  select bt.is_distributor into v_distributor from public.business_types bt where bt.id = new.business_type_id;
  select r.id into v_role_id from public.roles r where r.business_id is null and r.slug = case when v_distributor then 'distributor' else 'partner' end;
  if v_role_id is not null and not exists (
    select 1 from public.user_roles ur where ur.user_id = new.owner_user_id and ur.role_id = v_role_id and ur.business_id is null
  ) then
    insert into public.user_roles(user_id, role_id, business_id, assigned_by)
    values(new.owner_user_id, v_role_id, null, null) on conflict do nothing;
  end if;
  update public.users set account_type = case when v_distributor then 'distributor' else 'partner' end
  where id = new.owner_user_id and account_type = 'customer';
  return new;
end;
$$;
revoke all on function public.assign_business_owner_role() from public, anon, authenticated;
create trigger assign_business_owner_role_after_insert
after insert on public.businesses
for each row execute function public.assign_business_owner_role();

create or replace function public.list_distributor_network(p_partner_business_id uuid)
returns table (
  distributor_business_id uuid,
  distributor_name text,
  distributor_area text,
  access_status text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(p_partner_business_id, 'distributors.view')
    or not exists (
      select 1 from public.businesses b join public.business_types bt on bt.id = b.business_type_id
      where b.id = p_partner_business_id and b.status = 'approved' and not bt.is_distributor
    ) then raise exception 'Permission denied'; end if;
  return query
    select d.id, d.business_name, a.name, coalesce(dpa.status, 'not_requested'), dpa.created_at
    from public.businesses d
    join public.business_types dt on dt.id = d.business_type_id and dt.is_distributor
    left join public.areas a on a.id = d.area_id
    left join public.distributor_partner_access dpa on dpa.distributor_business_id = d.id and dpa.partner_business_id = p_partner_business_id
    where d.status = 'approved'
    order by d.business_name
    limit 200;
end;
$$;

create or replace function public.request_distributor_access(p_partner_business_id uuid, p_distributor_business_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_business_permission(p_partner_business_id, 'distributors.view')
    or not exists (
      select 1 from public.businesses b join public.business_types bt on bt.id = b.business_type_id
      where b.id = p_partner_business_id and b.status = 'approved' and not bt.is_distributor
    )
    or not exists (
      select 1 from public.businesses d join public.business_types dt on dt.id = d.business_type_id
      where d.id = p_distributor_business_id and d.status = 'approved' and dt.is_distributor
    ) then raise exception 'Permission denied'; end if;
  insert into public.distributor_partner_access(distributor_business_id, partner_business_id, requested_by, status)
  values (p_distributor_business_id, p_partner_business_id, auth.uid(), 'pending')
  on conflict (distributor_business_id, partner_business_id) do update set
    status = 'pending', requested_by = excluded.requested_by, reviewed_by = null,
    reviewed_at = null, review_note = null, updated_at = pg_catalog.now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_distributor_access_requests(p_distributor_business_id uuid)
returns table (
  access_id uuid,
  partner_business_id uuid,
  partner_name text,
  partner_area text,
  partner_type text,
  status text,
  requested_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(p_distributor_business_id, 'distributors.access.manage')
    or not exists (
      select 1 from public.businesses d join public.business_types bt on bt.id = d.business_type_id
      where d.id = p_distributor_business_id and bt.is_distributor
    ) then raise exception 'Permission denied'; end if;
  return query
    select a.id, p.id, p.business_name, ar.name, pt.name, a.status, a.created_at, a.review_note
    from public.distributor_partner_access a
    join public.businesses p on p.id = a.partner_business_id and p.status = 'approved'
    join public.business_types pt on pt.id = p.business_type_id and not pt.is_distributor
    left join public.areas ar on ar.id = p.area_id
    where a.distributor_business_id = p_distributor_business_id
    order by case when a.status = 'pending' then 0 else 1 end, a.created_at desc
    limit 200;
end;
$$;

create or replace function public.review_distributor_access(
  p_distributor_business_id uuid,
  p_partner_business_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.distributor_partner_access%rowtype;
  v_previous jsonb;
begin
  if not public.has_business_permission(p_distributor_business_id, 'distributors.access.manage') then raise exception 'Permission denied'; end if;
  if p_decision not in ('approved', 'rejected', 'revoked') or pg_catalog.length(coalesce(p_note, '')) > 1000 then raise exception 'Invalid access decision'; end if;
  select * into v_access from public.distributor_partner_access
    where distributor_business_id = p_distributor_business_id and partner_business_id = p_partner_business_id for update;
  if not found or (p_decision in ('approved', 'rejected') and v_access.status not in ('pending', 'rejected', 'revoked'))
    or (p_decision = 'revoked' and v_access.status <> 'approved') then raise exception 'Access request state does not allow this decision'; end if;
  v_previous := pg_catalog.to_jsonb(v_access);
  update public.distributor_partner_access set status = p_decision, review_note = nullif(pg_catalog.btrim(p_note), ''),
    reviewed_by = auth.uid(), reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_access.id returning * into v_access;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values(auth.uid(), p_decision, 'distributors', 'distributor_partner_access', v_access.id, v_previous, pg_catalog.to_jsonb(v_access));
  return v_access.id;
end;
$$;

create or replace function public.list_distributor_inventory_for_partner(
  p_partner_business_id uuid,
  p_distributor_business_id uuid,
  p_query text default null
)
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  inventory_status text,
  quantity integer,
  last_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(p_partner_business_id, 'distributors.view')
    or not exists (
      select 1 from public.businesses p join public.business_types pt on pt.id = p.business_type_id
      where p.id = p_partner_business_id and p.status = 'approved' and not pt.is_distributor
    )
    or not exists (
      select 1 from public.businesses d join public.business_types dt on dt.id = d.business_type_id
      where d.id = p_distributor_business_id and d.status = 'approved' and dt.is_distributor
    )
    or not exists (select 1 from public.distributor_partner_access a where a.distributor_business_id = p_distributor_business_id and a.partner_business_id = p_partner_business_id and a.status = 'approved') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) > 120 then raise exception 'Search is too long'; end if;
  return query
    select m.id, m.product_name, m.brand_name, c.name, m.strength, mf.name, i.status, i.quantity, i.updated_at
    from public.inventory i
    join public.medicines m on m.id = i.medicine_id and m.status = 'approved'
    left join public.compositions c on c.id = m.composition_id
    left join public.manufacturers mf on mf.id = m.manufacturer_id
    where i.business_id = p_distributor_business_id and i.status in ('available', 'low_stock')
      and (pg_catalog.btrim(coalesce(p_query, '')) = ''
        or m.normalized_product_name like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(m.brand_name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(c.name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(m.strength) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(mf.name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%')
    order by m.normalized_product_name, m.strength
    limit 100;
end;
$$;

revoke all on function public.list_distributor_network(uuid) from public, anon;
revoke all on function public.request_distributor_access(uuid, uuid) from public, anon;
revoke all on function public.list_distributor_access_requests(uuid) from public, anon;
revoke all on function public.review_distributor_access(uuid, uuid, text, text) from public, anon;
revoke all on function public.list_distributor_inventory_for_partner(uuid, uuid, text) from public, anon;
grant execute on function public.list_distributor_network(uuid) to authenticated;
grant execute on function public.request_distributor_access(uuid, uuid) to authenticated;
grant execute on function public.list_distributor_access_requests(uuid) to authenticated;
grant execute on function public.review_distributor_access(uuid, uuid, text, text) to authenticated;
grant execute on function public.list_distributor_inventory_for_partner(uuid, uuid, text) to authenticated;
