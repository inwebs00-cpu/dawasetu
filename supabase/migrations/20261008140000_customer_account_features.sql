create table public.saved_medicines (
  user_id uuid not null references public.users (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, medicine_id)
);

create index saved_medicines_medicine_idx on public.saved_medicines (medicine_id, created_at desc);

create table public.recent_medicine_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  normalized_query text not null check (length(normalized_query) between 2 and 120),
  query_text text not null check (length(query_text) between 2 and 120),
  search_count integer not null default 1 check (search_count > 0),
  first_searched_at timestamptz not null default now(),
  last_searched_at timestamptz not null default now(),
  unique (user_id, normalized_query)
);

create index recent_medicine_searches_user_last_idx on public.recent_medicine_searches (user_id, last_searched_at desc);

alter table public.saved_medicines enable row level security;
alter table public.recent_medicine_searches enable row level security;

grant select, delete on public.saved_medicines to authenticated;
grant select on public.recent_medicine_searches to authenticated;

create policy "users read own saved medicines" on public.saved_medicines
for select to authenticated using (user_id = auth.uid());
create policy "users remove own saved medicines" on public.saved_medicines
for delete to authenticated using (user_id = auth.uid());
create policy "users read own recent medicine searches" on public.recent_medicine_searches
for select to authenticated using (user_id = auth.uid());

create or replace function public.save_my_medicine(p_medicine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.medicines m
    where m.id = p_medicine_id and m.status = 'approved' and m.public_visibility
  ) then
    raise exception 'Medicine not found';
  end if;
  insert into public.saved_medicines(user_id, medicine_id)
  values (v_user_id, p_medicine_id)
  on conflict (user_id, medicine_id) do nothing;
  return true;
end;
$$;

create or replace function public.remove_my_saved_medicine(p_medicine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.saved_medicines
  where user_id = auth.uid() and medicine_id = p_medicine_id;
  return found;
end;
$$;

create or replace function public.list_my_saved_medicines()
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  saved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select m.id, m.product_name, m.brand_name, c.name, m.strength, mf.name, sm.created_at
  from public.saved_medicines sm
  join public.medicines m on m.id = sm.medicine_id and m.status = 'approved' and m.public_visibility
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  where sm.user_id = auth.uid()
  order by sm.created_at desc;
end;
$$;

create or replace function public.record_my_medicine_search(p_query text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := regexp_replace(btrim(coalesce(p_query, '')), '[[:space:]]+', ' ', 'g');
  v_normalized text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(v_query) not between 2 and 120 then raise exception 'Invalid search query'; end if;
  v_normalized := lower(v_query);
  insert into public.recent_medicine_searches(user_id, normalized_query, query_text)
  values (v_user_id, v_normalized, v_query)
  on conflict (user_id, normalized_query) do update set
    query_text = excluded.query_text,
    search_count = public.recent_medicine_searches.search_count + 1,
    last_searched_at = now();
end;
$$;

create or replace function public.list_my_recent_medicine_searches(p_limit integer default 10)
returns table (query_text text, search_count integer, last_searched_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then raise exception 'Invalid result limit'; end if;
  return query
  select s.query_text, s.search_count, s.last_searched_at
  from public.recent_medicine_searches s
  where s.user_id = auth.uid()
  order by s.last_searched_at desc
  limit p_limit;
end;
$$;

create or replace function public.mark_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.save_my_medicine(uuid) from public, anon;
revoke all on function public.remove_my_saved_medicine(uuid) from public, anon;
revoke all on function public.list_my_saved_medicines() from public, anon;
revoke all on function public.record_my_medicine_search(text) from public, anon;
revoke all on function public.list_my_recent_medicine_searches(integer) from public, anon;
revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.save_my_medicine(uuid) to authenticated;
grant execute on function public.remove_my_saved_medicine(uuid) to authenticated;
grant execute on function public.list_my_saved_medicines() to authenticated;
grant execute on function public.record_my_medicine_search(text) to authenticated;
grant execute on function public.list_my_recent_medicine_searches(integer) to authenticated;
grant execute on function public.mark_my_notifications_read() to authenticated;
