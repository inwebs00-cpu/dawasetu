-- Partner inventory and medicine submission RPCs. All mutations are checked
-- inside PostgreSQL because Server Actions can be invoked independently of UI.

create or replace function public.search_medicine_master(p_query text)
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  category_name text,
  medicine_type text,
  prescription_class text,
  packaging text,
  medicine_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.product_name, m.brand_name, c.name, m.strength, mf.name,
    cat.name, m.medicine_type, m.prescription_class, m.packaging, m.status
  from public.medicines m
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  left join public.categories cat on cat.id = m.category_id
  where pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 2 and 120
    and (m.status = 'approved' or m.submitted_by = auth.uid())
    and (
      pg_catalog.strpos(m.normalized_product_name, pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(m.brand_name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(c.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(m.strength), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(mf.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
    )
  order by (m.status = 'approved') desc, m.normalized_product_name, m.strength
  limit 20;
$$;

create or replace function public.submit_partner_medicine(
  p_business_id uuid,
  p_product_name text,
  p_brand_name text,
  p_composition text,
  p_strength text,
  p_manufacturer text,
  p_medicine_type text,
  p_prescription_class text,
  p_packaging text,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_name text := pg_catalog.btrim(coalesce(p_product_name, ''));
  v_composition_name text := pg_catalog.btrim(coalesce(p_composition, ''));
  v_manufacturer_name text := pg_catalog.btrim(coalesce(p_manufacturer, ''));
  v_strength text := pg_catalog.btrim(coalesce(p_strength, ''));
  v_composition_id uuid;
  v_manufacturer_id uuid;
  v_medicine_id uuid;
begin
  if not public.has_business_permission(p_business_id, 'inventory.manage') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(v_product_name) not between 1 and 240
    or pg_catalog.length(coalesce(p_brand_name, '')) > 240
    or pg_catalog.length(v_composition_name) not between 2 and 240
    or pg_catalog.length(v_manufacturer_name) not between 2 and 200
    or pg_catalog.length(v_strength) not between 1 and 120
    or pg_catalog.length(coalesce(p_packaging, '')) > 160
    or p_medicine_type is null
    or p_medicine_type not in ('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'device', 'other')
    or p_prescription_class is null
    or p_prescription_class not in ('prescription', 'otc', 'unknown') then
    raise exception 'Invalid medicine details';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and is_active
  ) then
    raise exception 'Invalid category';
  end if;

  insert into public.compositions (name, status)
  values (v_composition_name, 'pending')
  on conflict (normalized_name) do nothing;
  select id into v_composition_id
  from public.compositions
  where normalized_name = pg_catalog.lower(v_composition_name);

  insert into public.manufacturers (name, status)
  values (v_manufacturer_name, 'pending')
  on conflict (normalized_name) do nothing;
  select id into v_manufacturer_id
  from public.manufacturers
  where normalized_name = pg_catalog.lower(v_manufacturer_name);

  insert into public.medicines (
    product_name, brand_name, composition_id, strength, manufacturer_id,
    category_id, medicine_type, prescription_class, packaging, status, submitted_by
  ) values (
    v_product_name, nullif(pg_catalog.btrim(p_brand_name), ''), v_composition_id,
    v_strength, v_manufacturer_id, p_category_id, p_medicine_type,
    p_prescription_class, nullif(pg_catalog.btrim(p_packaging), ''), 'pending', auth.uid()
  )
  on conflict (normalized_product_name, strength, manufacturer_id) do nothing
  returning id into v_medicine_id;

  if v_medicine_id is null then
    select id into v_medicine_id from public.medicines
    where normalized_product_name = pg_catalog.lower(v_product_name)
      and strength = v_strength and manufacturer_id = v_manufacturer_id;
  end if;
  return v_medicine_id;
end;
$$;

create or replace function public.list_business_inventory(p_business_id uuid)
returns table (
  inventory_id uuid,
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  medicine_status text,
  inventory_status text,
  quantity integer,
  public_visible boolean,
  last_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, m.id, m.product_name, m.brand_name, c.name, m.strength,
    mf.name, m.status, i.status, i.quantity, coalesce(iv.public_visible, false), i.updated_at
  from public.inventory i
  join public.medicines m on m.id = i.medicine_id
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  left join public.inventory_visibility iv on iv.inventory_id = i.id
  where i.business_id = p_business_id
    and (public.has_business_permission(p_business_id, 'inventory.view')
      or public.has_business_permission(p_business_id, 'inventory.manage')
      or public.has_platform_permission('inventory.view'))
  order by i.updated_at desc
  limit 500;
$$;

create or replace function public.upsert_partner_inventory(
  p_business_id uuid,
  p_medicine_id uuid,
  p_status text,
  p_quantity integer default null,
  p_public_visible boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory_id uuid;
begin
  if not public.has_business_permission(p_business_id, 'inventory.manage') then
    raise exception 'Permission denied';
  end if;
  if p_status not in ('available', 'low_stock', 'out_of_stock')
    or p_quantity < 0
    or (p_quantity = 0 and p_status <> 'out_of_stock') then
    raise exception 'Invalid inventory status or quantity';
  end if;
  if not exists (
    select 1 from public.medicines where id = p_medicine_id and status = 'approved'
  ) then
    raise exception 'Medicine must be approved before it can be added to inventory';
  end if;

  insert into public.inventory (business_id, medicine_id, status, quantity, updated_by, last_verified_at)
  values (p_business_id, p_medicine_id, p_status, p_quantity, auth.uid(), pg_catalog.now())
  on conflict (business_id, medicine_id) do update set
    status = excluded.status,
    quantity = excluded.quantity,
    updated_by = excluded.updated_by,
    last_verified_at = excluded.last_verified_at,
    updated_at = pg_catalog.now()
  returning id into v_inventory_id;

  insert into public.inventory_visibility (inventory_id, public_visible, updated_by)
  values (v_inventory_id, coalesce(p_public_visible, false), auth.uid())
  on conflict (inventory_id) do update set
    public_visible = excluded.public_visible,
    updated_by = excluded.updated_by,
    updated_at = pg_catalog.now();
  return v_inventory_id;
end;
$$;

create or replace function public.add_partner_inventory_item(
  p_business_id uuid,
  p_medicine_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory_id uuid;
begin
  if not public.has_business_permission(p_business_id, 'inventory.manage') then
    raise exception 'Permission denied';
  end if;
  if not exists (select 1 from public.medicines where id = p_medicine_id and status = 'approved') then
    raise exception 'Medicine must be approved before it can be added to inventory';
  end if;

  insert into public.inventory (business_id, medicine_id, status, quantity, updated_by)
  values (p_business_id, p_medicine_id, 'out_of_stock', 0, auth.uid())
  on conflict (business_id, medicine_id) do nothing
  returning id into v_inventory_id;
  if v_inventory_id is null then
    select id into v_inventory_id from public.inventory
    where business_id = p_business_id and medicine_id = p_medicine_id;
  end if;
  insert into public.inventory_visibility (inventory_id, public_visible, updated_by)
  values (v_inventory_id, false, auth.uid())
  on conflict (inventory_id) do nothing;
  return v_inventory_id;
end;
$$;

revoke all on function public.search_medicine_master(text) from public, anon;
revoke all on function public.submit_partner_medicine(uuid, text, text, text, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.list_business_inventory(uuid) from public, anon;
revoke all on function public.upsert_partner_inventory(uuid, uuid, text, integer, boolean) from public, anon;
revoke all on function public.add_partner_inventory_item(uuid, uuid) from public, anon;
grant execute on function public.search_medicine_master(text) to authenticated;
grant execute on function public.submit_partner_medicine(uuid, text, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.list_business_inventory(uuid) to authenticated;
grant execute on function public.upsert_partner_inventory(uuid, uuid, text, integer, boolean) to authenticated;
grant execute on function public.add_partner_inventory_item(uuid, uuid) to authenticated;

revoke insert, update, delete on public.inventory, public.inventory_visibility from authenticated;
grant select on public.inventory, public.inventory_visibility to authenticated;

create or replace function public.can_business_respond_to_request(
  p_request_id uuid,
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.medicine_requests mr
    join public.businesses b on b.id = p_business_id
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where mr.id = p_request_id
      and mr.status in ('open', 'partially_fulfilled')
      and mr.expires_at > pg_catalog.now()
      and mr.customer_area_id is not null
      and mr.customer_area_id = b.area_id
      and b.status = 'approved'
      and b.public_availability_enabled
  );
$$;

revoke all on function public.can_business_respond_to_request(uuid, uuid) from public, anon;
grant execute on function public.can_business_respond_to_request(uuid, uuid) to authenticated;

create or replace function public.respond_to_medicine_request(
  p_business_id uuid,
  p_request_id uuid,
  p_response text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_response_id uuid;
begin
  if not public.has_business_permission(p_business_id, 'requests.respond')
    or not public.can_business_respond_to_request(p_request_id, p_business_id) then
    raise exception 'Permission denied';
  end if;
  if p_response not in ('available', 'unavailable')
    or pg_catalog.length(coalesce(p_message, '')) > 1000 then
    raise exception 'Invalid response';
  end if;
  insert into public.medicine_request_responses (
    request_id, business_id, response, message, responded_by
  ) values (
    p_request_id, p_business_id, p_response, nullif(pg_catalog.btrim(p_message), ''), auth.uid()
  )
  on conflict (request_id, business_id) do update set
    response = excluded.response,
    message = excluded.message,
    responded_by = excluded.responded_by,
    updated_at = pg_catalog.now()
  returning id into v_response_id;
  return v_response_id;
end;
$$;

revoke all on function public.respond_to_medicine_request(uuid, uuid, text, text) from public, anon;
grant execute on function public.respond_to_medicine_request(uuid, uuid, text, text) to authenticated;

drop policy if exists "business owners and public profiles are readable" on public.businesses;
create policy "authorized members read business profiles" on public.businesses for select to authenticated using (
  public.has_business_permission(id, 'dashboard.view')
  or public.has_business_permission(id, 'partners.view')
  or public.has_platform_permission('partners.view')
);

drop policy if exists "business members read inventory" on public.inventory;
create policy "authorized members read inventory" on public.inventory for select to authenticated using (
  public.has_business_permission(business_id, 'inventory.view')
  or public.has_business_permission(business_id, 'inventory.manage')
  or public.has_platform_permission('inventory.view')
);

drop policy if exists "business members read inventory visibility" on public.inventory_visibility;
create policy "authorized members read inventory visibility" on public.inventory_visibility for select to authenticated using (
  exists (
    select 1 from public.inventory i
    where i.id = inventory_id and (
      public.has_business_permission(i.business_id, 'inventory.view')
      or public.has_business_permission(i.business_id, 'inventory.manage')
      or public.has_platform_permission('inventory.view')
    )
  )
);

drop policy if exists "approved partners can register own business" on public.businesses;
create policy "partners can register own pending non-distributor business" on public.businesses for insert to authenticated with check (
  owner_user_id = auth.uid()
  and status = 'pending'
  and not public_availability_enabled
  and exists (
    select 1 from public.business_types bt
    where bt.id = business_type_id and bt.is_active and not bt.is_distributor
  )
  and not public.has_platform_permission('partners.manage')
);

create or replace function public.list_my_businesses()
returns table (
  business_id uuid,
  business_name text,
  business_slug text,
  business_type text,
  business_status text,
  public_availability_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.business_name, b.slug, bt.name, b.status, b.public_availability_enabled
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id
  where exists (
    select 1 from public.users u where u.id = auth.uid() and u.status = 'active'
  )
    and (public.has_business_permission(b.id, 'dashboard.view')
      or public.has_business_permission(b.id, 'partners.view')
      or public.has_business_permission(b.id, 'inventory.view')
      or public.has_business_permission(b.id, 'inventory.manage'))
  order by b.created_at desc;
$$;

drop policy if exists "businesses respond to requests" on public.medicine_request_responses;
drop policy if exists "businesses respond to local active requests" on public.medicine_request_responses;
revoke insert, update on public.medicine_request_responses from authenticated;
grant insert (request_id, business_id, response, message, responded_by) on public.medicine_request_responses to authenticated;
grant update (response, message) on public.medicine_request_responses to authenticated;
create policy "businesses respond to local active requests" on public.medicine_request_responses for insert to authenticated with check (
  public.has_business_permission(business_id, 'requests.respond')
  and public.can_business_respond_to_request(request_id, business_id)
  and (responded_by is null or responded_by = auth.uid())
);

drop policy if exists "businesses update own request responses" on public.medicine_request_responses;
create policy "businesses update active request responses" on public.medicine_request_responses for update to authenticated using (
  public.has_business_permission(business_id, 'requests.respond')
  and public.can_business_respond_to_request(request_id, business_id)
) with check (
  public.has_business_permission(business_id, 'requests.respond')
  and public.can_business_respond_to_request(request_id, business_id)
);

create or replace function public.create_medicine_request(
  p_medicine_id uuid,
  p_requested_medicine_name text,
  p_composition_text text,
  p_strength text,
  p_quantity integer,
  p_customer_area_id uuid,
  p_note text,
  p_contact_preference text,
  p_contact_phone_e164 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u where u.id = auth.uid() and u.status = 'active'
  ) then
    raise exception 'Sign in required';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_requested_medicine_name, ''))) not between 1 and 240
    or p_quantity is null or p_quantity < 1 or p_quantity > 100
    or p_contact_preference not in ('in_app', 'call', 'whatsapp')
    or pg_catalog.length(coalesce(p_note, '')) > 1000
    or p_customer_area_id is null
    or (p_contact_preference in ('call', 'whatsapp')
      and coalesce(p_contact_phone_e164, '') !~ E'^\\+[1-9][0-9]{7,14}$') then
    raise exception 'Invalid request';
  end if;
  if p_medicine_id is not null and not exists (
    select 1 from public.medicines m where m.id = p_medicine_id and m.status = 'approved'
  ) then
    raise exception 'Invalid medicine';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.medicine_requests mr
      where mr.customer_user_id = auth.uid() and mr.created_at > pg_catalog.now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Try again later.';
  end if;

  insert into public.medicine_requests (
    customer_user_id, medicine_id, requested_medicine_name, composition_text,
    strength, quantity, customer_area_id, note, contact_preference, contact_phone_e164
  ) values (
    auth.uid(), p_medicine_id, pg_catalog.btrim(p_requested_medicine_name),
    nullif(pg_catalog.btrim(p_composition_text), ''), nullif(pg_catalog.btrim(p_strength), ''),
    p_quantity, p_customer_area_id, nullif(pg_catalog.btrim(p_note), ''),
    p_contact_preference, nullif(pg_catalog.btrim(p_contact_phone_e164), '')
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.create_medicine_request(uuid, text, text, text, integer, uuid, text, text, text) from public, anon;
grant execute on function public.create_medicine_request(uuid, text, text, text, integer, uuid, text, text, text) to authenticated;

drop policy if exists "customers create own medicine requests" on public.medicine_requests;
revoke insert on public.medicine_requests from authenticated;

create or replace function public.list_business_medicine_requests(p_business_id uuid)
returns table (
  request_id uuid,
  requested_medicine_name text,
  composition_text text,
  strength text,
  quantity integer,
  approximate_area text,
  request_time timestamptz,
  expires_at timestamptz,
  status text,
  response text
)
language sql
stable
security definer
set search_path = ''
as $$
  select mr.id, mr.requested_medicine_name, mr.composition_text, mr.strength,
    mr.quantity, a.name, mr.created_at, mr.expires_at, mr.status, rr.response
  from public.medicine_requests mr
  join public.businesses b on b.id = p_business_id
    and b.status = 'approved' and b.public_availability_enabled
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  left join public.areas a on a.id = mr.customer_area_id
  left join public.medicine_request_responses rr
    on rr.request_id = mr.id and rr.business_id = p_business_id
  where public.has_business_permission(p_business_id, 'requests.view')
    and mr.status in ('open', 'partially_fulfilled')
    and mr.expires_at > pg_catalog.now()
    and mr.customer_area_id is not null
    and mr.customer_area_id = b.area_id
  order by mr.created_at desc
  limit 100;
$$;

revoke all on function public.list_business_medicine_requests(uuid) from public, anon;
grant execute on function public.list_business_medicine_requests(uuid) to authenticated;
revoke insert, update on public.medicine_request_responses from authenticated;

create or replace function public.notify_medicine_request_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_business_name text;
  v_medicine_name text;
begin
  select mr.customer_user_id, b.business_name, mr.requested_medicine_name
  into v_customer_id, v_business_name, v_medicine_name
  from public.medicine_requests mr
  join public.businesses b on b.id = new.business_id
  where mr.id = new.request_id;
  if v_customer_id is not null and new.response = 'available'
    and (tg_op = 'INSERT' or old.response is distinct from new.response) then
    insert into public.notifications (user_id, business_id, event_type, title, body, payload)
    values (
      v_customer_id, new.business_id, 'medicine_request_response',
      'A nearby partner may have your medicine',
      v_business_name || ' responded to your request for ' || v_medicine_name || '.',
      pg_catalog.jsonb_build_object('request_id', new.request_id, 'response_id', new.id)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_medicine_request_response() from public, anon, authenticated;
create trigger notify_medicine_request_response_after_insert
  after insert or update of response on public.medicine_request_responses
  for each row execute function public.notify_medicine_request_response();

-- Requests are created through the validated RPC so clients cannot extend expiry
-- or set another user's identity. Direct partner response reads remain scoped.
