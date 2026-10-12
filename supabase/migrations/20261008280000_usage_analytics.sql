create table public.business_profile_view_events (
  business_id uuid not null references public.businesses (id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (business_id, visitor_hash, viewed_on)
);

create table public.medicine_search_events (
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  searched_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (medicine_id, visitor_hash, searched_on)
);

create index business_profile_views_daily_idx
on public.business_profile_view_events (business_id, viewed_on desc);
create index medicine_search_events_daily_idx
on public.medicine_search_events (medicine_id, searched_on desc);

alter table public.business_profile_view_events enable row level security;
alter table public.medicine_search_events enable row level security;
revoke all on public.business_profile_view_events, public.medicine_search_events from public, anon, authenticated;
grant select, insert on public.business_profile_view_events, public.medicine_search_events to service_role;

create or replace function public.service_record_business_profile_view(
  p_business_id uuid,
  p_viewer_user_id uuid,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inserted integer;
begin
  if p_visitor_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if not exists (
    select 1 from public.businesses b
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where b.id = p_business_id and b.status = 'approved'
      and b.public_availability_enabled
  ) then return false; end if;
  if p_viewer_user_id is not null and exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_user_id = p_viewer_user_id
    union all
    select 1 from public.business_team_members tm
    where tm.business_id = p_business_id and tm.user_id = p_viewer_user_id
      and tm.status = 'active'
  ) then return false; end if;

  insert into public.business_profile_view_events(business_id, visitor_hash, viewed_on)
  values (p_business_id, p_visitor_hash, current_date)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

create or replace function public.service_record_medicine_search(
  p_medicine_id uuid,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inserted integer;
begin
  if p_visitor_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if not exists (
    select 1 from public.medicines m
    join public.inventory i on i.medicine_id = m.id and i.status in ('available', 'low_stock')
    join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
    join public.businesses b on b.id = i.business_id
      and b.status = 'approved' and b.public_availability_enabled
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where m.id = p_medicine_id and m.status = 'approved' and m.public_visibility
  ) then return false; end if;

  insert into public.medicine_search_events(medicine_id, visitor_hash, searched_on)
  values (p_medicine_id, p_visitor_hash, current_date)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

create or replace function public.list_my_business_analytics(
  p_business_id uuid,
  p_days integer default 30
)
returns table (
  profile_views bigint,
  medicine_searches bigint,
  medicine_requests bigint,
  inquiries bigint,
  confirmed_orders bigint,
  available_inventory bigint,
  total_inventory bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_business_permission(p_business_id, 'reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select
    (select count(*) from public.business_profile_view_events v
      where v.business_id = p_business_id and v.viewed_on >= current_date - p_days + 1),
    (select count(*) from public.medicine_search_events se
      join public.inventory i on i.medicine_id = se.medicine_id and i.business_id = p_business_id
      where se.searched_on >= current_date - p_days + 1),
    (select count(distinct rr.request_id) from public.medicine_request_responses rr
      join public.medicine_requests mr on mr.id = rr.request_id
      where rr.business_id = p_business_id and mr.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.inquiries q
      where q.business_id = p_business_id and q.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.orders o
      where o.business_id = p_business_id and o.status in ('confirmed', 'completed')
        and o.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.inventory i
      where i.business_id = p_business_id and i.status in ('available', 'low_stock')),
    (select count(*) from public.inventory i where i.business_id = p_business_id);
end;
$$;

create or replace function public.list_my_business_search_trends(
  p_business_id uuid,
  p_days integer default 30
)
returns table (
  medicine_id uuid,
  product_name text,
  strength text,
  search_count bigint,
  inventory_status text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_business_permission(p_business_id, 'reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select m.id, m.product_name, m.strength, count(se.medicine_id), i.status
  from public.inventory i
  join public.medicines m on m.id = i.medicine_id
  left join public.medicine_search_events se on se.medicine_id = m.id
    and se.searched_on >= current_date - p_days + 1
  where i.business_id = p_business_id
  group by m.id, m.product_name, m.strength, i.status
  order by count(se.medicine_id) desc, m.product_name
  limit 20;
end;
$$;

create or replace function public.admin_get_analytics_summary(p_days integer default 30)
returns table (
  total_users bigint,
  new_users bigint,
  approved_partners bigint,
  new_approved_partners bigint,
  medicine_searches bigint,
  profile_views bigint,
  medicine_requests bigint,
  paid_revenue_inr numeric
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select
    (select count(*) from public.users),
    (select count(*) from public.users u where u.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.businesses b where b.status = 'approved'),
    (select count(*) from public.businesses b where b.status = 'approved'
      and b.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.medicine_search_events e
      where e.searched_on >= current_date - p_days + 1),
    (select count(*) from public.business_profile_view_events e
      where e.viewed_on >= current_date - p_days + 1),
    (select count(*) from public.medicine_requests r
      where r.created_at >= now() - make_interval(days => p_days)),
    (select coalesce(sum(p.amount_inr), 0)::numeric(12,2) from public.payments p
      where p.status = 'paid' and p.paid_at >= now() - make_interval(days => p_days));
end;
$$;

create or replace function public.admin_list_top_medicine_searches(
  p_days integer default 30
)
returns table (
  medicine_id uuid,
  product_name text,
  strength text,
  search_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select m.id, m.product_name, m.strength, count(e.medicine_id)
  from public.medicine_search_events e
  join public.medicines m on m.id = e.medicine_id
  where e.searched_on >= current_date - p_days + 1
  group by m.id, m.product_name, m.strength
  order by count(e.medicine_id) desc, m.product_name
  limit 20;
end;
$$;

create or replace function public.admin_list_analytics_regions(p_days integer default 30)
returns table (
  state_name text,
  district_name text,
  approved_partners bigint,
  medicine_requests bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select s.name, d.name,
    count(distinct b.id) filter (where b.status = 'approved'),
    count(distinct mr.id)
  from public.states s
  join public.districts d on d.state_id = s.id
  left join public.areas a on a.district_id = d.id
  left join public.businesses b on b.area_id = a.id
  left join public.medicine_requests mr on mr.customer_area_id = a.id
    and mr.created_at >= now() - make_interval(days => p_days)
  where s.is_active and d.is_active
  group by s.name, d.name
  having count(distinct b.id) > 0 or count(distinct mr.id) > 0
  order by count(distinct mr.id) desc, count(distinct b.id) desc, s.name, d.name
  limit 100;
end;
$$;

revoke all on function public.service_record_business_profile_view(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.service_record_medicine_search(uuid, text) from public, anon, authenticated;
grant execute on function public.service_record_business_profile_view(uuid, uuid, text) to service_role;
grant execute on function public.service_record_medicine_search(uuid, text) to service_role;
revoke all on function public.list_my_business_analytics(uuid, integer) from public, anon;
revoke all on function public.list_my_business_search_trends(uuid, integer) from public, anon;
revoke all on function public.admin_get_analytics_summary(integer) from public, anon;
revoke all on function public.admin_list_top_medicine_searches(integer) from public, anon;
revoke all on function public.admin_list_analytics_regions(integer) from public, anon;
grant execute on function public.list_my_business_analytics(uuid, integer) to authenticated;
grant execute on function public.list_my_business_search_trends(uuid, integer) to authenticated;
grant execute on function public.admin_get_analytics_summary(integer) to authenticated;
grant execute on function public.admin_list_top_medicine_searches(integer) to authenticated;
grant execute on function public.admin_list_analytics_regions(integer) to authenticated;
