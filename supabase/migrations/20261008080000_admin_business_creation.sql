create or replace function public.admin_create_business(
  p_owner_email text,
  p_business_type_id uuid,
  p_business_name text,
  p_registration_number text,
  p_phone_e164 text,
  p_whatsapp_e164 text,
  p_email text,
  p_address_line1 text,
  p_address_line2 text,
  p_area_id uuid,
  p_postal_code text,
  p_latitude numeric,
  p_longitude numeric,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_business_id uuid;
  v_slug text;
begin
  if not public.has_platform_permission('partners.manage') then raise exception 'Permission denied'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_owner_email, ''))) > 254
    or p_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_business_name, ''))) not between 2 and 200
    or pg_catalog.length(coalesce(p_registration_number, '')) > 100
    or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
    or (p_whatsapp_e164 is not null and p_whatsapp_e164 !~ '^\+[1-9][0-9]{7,14}$')
    or (p_email is not null and (pg_catalog.length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_address_line1, ''))) not between 5 and 240
    or pg_catalog.length(coalesce(p_address_line2, '')) > 240
    or pg_catalog.length(coalesce(p_description, '')) > 1000
    or (p_postal_code is not null and p_postal_code !~ '^[0-9]{6}$')
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and p_latitude not between -90 and 90)
    or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'Invalid business details';
  end if;
  select au.id into v_owner_id from auth.users au
  join public.users u on u.id = au.id and u.status = 'active'
  where pg_catalog.lower(au.email) = pg_catalog.lower(pg_catalog.btrim(p_owner_email));
  if v_owner_id is null then raise exception 'Owner account not found'; end if;
  if not exists (select 1 from public.business_types bt where bt.id = p_business_type_id and bt.is_active) then
    raise exception 'Invalid business type';
  end if;
  if p_area_id is not null and not exists (select 1 from public.areas where id = p_area_id and is_active) then
    raise exception 'Invalid business area';
  end if;
  v_slug := pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(p_business_name), '[^a-z0-9]+', '-', 'g'), '-') || '-' || pg_catalog.substr(gen_random_uuid()::text, 1, 8);
  insert into public.businesses (
    owner_user_id, business_type_id, business_name, slug, registration_number,
    description, phone_e164, whatsapp_e164, email, address_line1, address_line2,
    area_id, postal_code, latitude, longitude, public_availability_enabled, status
  ) values (
    v_owner_id, p_business_type_id, pg_catalog.btrim(p_business_name), v_slug,
    nullif(pg_catalog.btrim(p_registration_number), ''), nullif(pg_catalog.btrim(p_description), ''),
    p_phone_e164, p_whatsapp_e164, nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
    pg_catalog.btrim(p_address_line1), nullif(pg_catalog.btrim(p_address_line2), ''),
    p_area_id, p_postal_code, p_latitude, p_longitude, false, 'pending'
  ) returning id into v_business_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (auth.uid(), 'create', 'partners', 'businesses', v_business_id,
    (select pg_catalog.to_jsonb(b) from public.businesses b where b.id = v_business_id));
  return v_business_id;
end;
$$;

revoke all on function public.admin_create_business(text, uuid, text, text, text, text, text, text, text, uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.admin_create_business(text, uuid, text, text, text, text, text, text, text, uuid, text, numeric, numeric, text) to authenticated;
