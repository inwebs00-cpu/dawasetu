create table public.doctor_booking_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  specialty text not null check (length(btrim(specialty)) between 2 and 120),
  description text check (description is null or length(description) <= 2000),
  booking_url text not null check (
    length(booking_url) <= 2048
    and booking_url ~* '^https://([a-z0-9-]+\.)*click2book\.in(:443)?([/?#][^[:space:]]*)?$'
  ),
  display_order integer not null default 0 check (display_order between 0 and 10000),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctor_booking_profiles_active_order_idx
  on public.doctor_booking_profiles (is_active, display_order, full_name);
create index doctor_booking_profiles_business_idx
  on public.doctor_booking_profiles (business_id) where business_id is not null;
create trigger set_updated_at before update on public.doctor_booking_profiles
  for each row execute function public.set_updated_at();

alter table public.doctor_booking_profiles enable row level security;
revoke all on public.doctor_booking_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.doctor_booking_profiles to service_role;

create or replace function public.admin_list_doctor_booking_profiles()
returns table (
  doctor_id uuid,
  business_id uuid,
  business_name text,
  full_name text,
  slug text,
  specialty text,
  description text,
  booking_url text,
  display_order integer,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select d.id, d.business_id, b.business_name, d.full_name, d.slug,
    d.specialty, d.description, d.booking_url, d.display_order, d.is_active, d.updated_at
  from public.doctor_booking_profiles d
  left join public.businesses b on b.id = d.business_id
  order by d.display_order, d.full_name
  limit 500;
end;
$$;

create or replace function public.admin_save_doctor_booking_profile(
  p_doctor_id uuid,
  p_business_id uuid,
  p_full_name text,
  p_slug text,
  p_specialty text,
  p_description text,
  p_booking_url text,
  p_display_order integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_previous jsonb;
  v_url text := trim(coalesce(p_booking_url, ''));
begin
  if v_actor is null or not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  if length(btrim(coalesce(p_full_name, ''))) not between 2 and 160
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 180
    or length(btrim(coalesce(p_specialty, ''))) not between 2 and 120
    or length(coalesce(p_description, '')) > 2000
    or length(v_url) > 2048
    or v_url !~* '^https://([a-z0-9-]+\.)*click2book\.in(:443)?([/?#][^[:space:]]*)?$'
    or p_display_order is null or p_display_order not between 0 and 10000
    or p_is_active is null
    or (p_business_id is not null and not exists (
      select 1 from public.businesses b
      join public.business_types bt on bt.id = b.business_type_id
      where b.id = p_business_id
        and bt.slug in ('clinic_pharmacy', 'nursing_home_pharmacy')
    )) then
    raise exception 'Invalid doctor booking profile';
  end if;

  if p_doctor_id is null then
    insert into public.doctor_booking_profiles(
      business_id, full_name, slug, specialty, description, booking_url, display_order, is_active
    ) values (
      p_business_id, btrim(p_full_name), p_slug, btrim(p_specialty),
      nullif(btrim(p_description), ''), v_url, p_display_order, p_is_active
    ) returning id into v_id;
  else
    select to_jsonb(d) into v_previous from public.doctor_booking_profiles d
    where d.id = p_doctor_id for update;
    if not found then raise exception 'Doctor booking profile not found'; end if;
    update public.doctor_booking_profiles d set
      business_id = p_business_id,
      full_name = btrim(p_full_name),
      slug = p_slug,
      specialty = btrim(p_specialty),
      description = nullif(btrim(p_description), ''),
      booking_url = v_url,
      display_order = p_display_order,
      is_active = p_is_active,
      updated_at = now()
    where d.id = p_doctor_id returning d.id into v_id;
  end if;

  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value, new_value
  ) values (
    v_actor,
    case when p_doctor_id is null then 'doctor_booking_profile.created' else 'doctor_booking_profile.updated' end,
    'content', 'doctor_booking_profiles', v_id, v_previous,
    jsonb_build_object(
      'business_id', p_business_id, 'full_name', btrim(p_full_name),
      'slug', p_slug, 'specialty', btrim(p_specialty), 'booking_url', v_url,
      'display_order', p_display_order, 'is_active', p_is_active
    )
  );
  return v_id;
end;
$$;

create or replace function public.admin_delete_doctor_booking_profile(p_doctor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  delete from public.doctor_booking_profiles d
  where d.id = p_doctor_id returning to_jsonb(d) into v_previous;
  if v_previous is null then raise exception 'Doctor booking profile not found'; end if;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value
  ) values (
    v_actor, 'doctor_booking_profile.deleted', 'content', 'doctor_booking_profiles', p_doctor_id, v_previous
  );
end;
$$;

create or replace function public.list_public_doctor_booking_profiles()
returns table (
  doctor_id uuid,
  slug text,
  full_name text,
  specialty text,
  business_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select d.id, d.slug, d.full_name, d.specialty, b.business_name
  from public.doctor_booking_profiles d
  left join public.businesses b on b.id = d.business_id
  where d.is_active and (d.business_id is null or b.status = 'approved')
  order by d.display_order, d.full_name
  limit 100;
$$;

create or replace function public.get_public_doctor_booking_profile(p_slug text)
returns table (
  doctor_id uuid,
  slug text,
  full_name text,
  specialty text,
  description text,
  booking_url text,
  business_name text,
  business_slug text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select d.id, d.slug, d.full_name, d.specialty, d.description, d.booking_url,
    b.business_name, b.slug
  from public.doctor_booking_profiles d
  left join public.businesses b on b.id = d.business_id
  where d.slug = p_slug and d.is_active
    and (d.business_id is null or b.status = 'approved')
  limit 1;
$$;

revoke all on function public.admin_list_doctor_booking_profiles() from public, anon;
revoke all on function public.admin_save_doctor_booking_profile(uuid, uuid, text, text, text, text, text, integer, boolean) from public, anon;
revoke all on function public.admin_delete_doctor_booking_profile(uuid) from public, anon;
revoke all on function public.list_public_doctor_booking_profiles() from public;
revoke all on function public.get_public_doctor_booking_profile(text) from public;
grant execute on function public.admin_list_doctor_booking_profiles() to authenticated;
grant execute on function public.admin_save_doctor_booking_profile(uuid, uuid, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_delete_doctor_booking_profile(uuid) to authenticated;
grant execute on function public.list_public_doctor_booking_profiles() to anon, authenticated;
grant execute on function public.get_public_doctor_booking_profile(text) to anon, authenticated;
