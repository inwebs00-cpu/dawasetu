create or replace function public.admin_list_businesses(
  p_status text default null,
  p_business_type_slug text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  business_id uuid,
  business_name text,
  business_slug text,
  business_type text,
  business_type_slug text,
  owner_user_id uuid,
  owner_name text,
  email text,
  phone_e164 text,
  registration_number text,
  address_line1 text,
  address_line2 text,
  area_name text,
  postal_code text,
  business_status text,
  review_note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('partners.view')
    and not public.has_platform_permission('partners.manage')
    and not public.has_platform_permission('partners.approve') then
    raise exception 'Permission denied';
  end if;
  if (p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'suspended'))
    or p_limit not between 1 and 100 or p_offset < 0 then
    raise exception 'Invalid business filters';
  end if;
  return query select b.id, b.business_name, b.slug, bt.name, bt.slug,
    b.owner_user_id, u.full_name, b.email, b.phone_e164, b.registration_number,
    b.address_line1, b.address_line2, a.name, b.postal_code, b.status,
    b.review_note, b.created_at
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id
  join public.users u on u.id = b.owner_user_id
  left join public.areas a on a.id = b.area_id
  where (p_status is null or b.status = p_status)
    and (p_business_type_slug is null or bt.slug = p_business_type_slug)
  order by case when b.status = 'pending' then 0 else 1 end, b.created_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_review_business(
  p_business_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_previous jsonb;
begin
  if not public.has_platform_permission('partners.approve') then raise exception 'Permission denied'; end if;
  if p_decision not in ('approved', 'rejected', 'suspended') or pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception 'Invalid review decision';
  end if;
  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Business not found'; end if;
  if (p_decision in ('approved', 'rejected') and v_business.status not in ('pending', 'rejected', 'suspended'))
    or (p_decision = 'suspended' and v_business.status <> 'approved') then
    raise exception 'Business state does not allow this decision';
  end if;
  v_previous := pg_catalog.to_jsonb(v_business);
  update public.businesses set status = p_decision, review_note = nullif(pg_catalog.btrim(p_note), ''),
    reviewed_by = auth.uid(), reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_business_id returning * into v_business;
  if p_decision <> 'approved' then
    update public.businesses set public_availability_enabled = false where id = p_business_id;
    v_business.public_availability_enabled := false;
  end if;
  insert into public.audit_logs (actor_user_id, role_slug, action, module, record_table, record_id, previous_value, new_value)
  values (auth.uid(), coalesce((select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and ur.business_id is null order by r.slug limit 1), 'unknown'), p_decision, 'partners', 'businesses', p_business_id, v_previous, pg_catalog.to_jsonb(v_business));
  return p_business_id;
end;
$$;

create or replace function public.admin_save_area(
  p_state_name text,
  p_state_code text,
  p_district_name text,
  p_area_name text,
  p_postal_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state_id uuid;
  v_district_id uuid;
  v_area_id uuid;
  v_previous jsonb;
begin
  if not public.has_platform_permission('partners.manage') and not public.has_platform_permission('settings.manage') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_state_name, ''))) not between 2 and 100
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_state_code, ''))) not between 2 and 6
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_district_name, ''))) not between 2 and 100
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_area_name, ''))) not between 2 and 100
    or (p_postal_code is not null and p_postal_code !~ '^[0-9]{6}$') then
    raise exception 'Invalid geographic details';
  end if;
  insert into public.states (country_code, name, code)
  values ('IN', pg_catalog.btrim(p_state_name), pg_catalog.upper(pg_catalog.btrim(p_state_code)))
  on conflict (country_code, code) do update set name = excluded.name, is_active = true
  returning id into v_state_id;
  insert into public.districts (state_id, name)
  values (v_state_id, pg_catalog.btrim(p_district_name))
  on conflict (state_id, name) do update set is_active = true
  returning id into v_district_id;

  select id into v_area_id from public.areas
  where district_id = v_district_id and name = pg_catalog.btrim(p_area_name)
    and postal_code is not distinct from nullif(pg_catalog.btrim(p_postal_code), '');
  if v_area_id is null then
    insert into public.areas (district_id, name, postal_code)
    values (v_district_id, pg_catalog.btrim(p_area_name), nullif(pg_catalog.btrim(p_postal_code), ''))
    returning id into v_area_id;
  else
    select pg_catalog.to_jsonb(a) into v_previous from public.areas a where a.id = v_area_id;
    update public.areas set is_active = true where id = v_area_id;
  end if;
  insert into public.audit_logs (actor_user_id, role_slug, action, module, record_table, record_id, previous_value, new_value)
  values (auth.uid(), coalesce((select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and ur.business_id is null order by r.slug limit 1), 'unknown'), 'upsert', 'locations', 'areas', v_area_id, v_previous, (select pg_catalog.to_jsonb(a) from public.areas a where a.id = v_area_id));
  return v_area_id;
end;
$$;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon;
revoke all on function public.admin_review_business(uuid, text, text) from public, anon;
revoke all on function public.admin_save_area(text, text, text, text, text) from public, anon;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;
grant execute on function public.admin_review_business(uuid, text, text) to authenticated;
grant execute on function public.admin_save_area(text, text, text, text, text) to authenticated;
