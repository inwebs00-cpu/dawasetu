-- Authentication bootstrap, authorization helpers, public search and RLS policies.

create or replace function public.bootstrap_dawasetu_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_role_id uuid;
begin
  v_name := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '');
  insert into public.users (id, account_type, full_name)
  values (new.id, 'customer', coalesce(v_name, 'DawaSetu User'))
  on conflict (id) do nothing;

  select id into v_role_id
  from public.roles
  where business_id is null and slug = 'customer' and is_active;
  if v_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_role_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dawasetu on auth.users;
create trigger on_auth_user_created_dawasetu
  after insert on auth.users
  for each row execute function public.bootstrap_dawasetu_user();

create or replace function public.has_platform_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.business_id is null and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = ur.user_id and u.status = 'active'
    where ur.user_id = auth.uid()
      and ur.business_id is null
      and p.permission_key = p_permission_key
  );
$$;

create or replace function public.is_active_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    join public.users u on u.id = auth.uid() and u.status = 'active'
    where b.id = p_business_id and b.owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.business_team_members tm
    join public.users u on u.id = tm.user_id and u.status = 'active'
    where tm.business_id = p_business_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.has_business_permission(p_business_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    join public.users u on u.id = auth.uid() and u.status = 'active'
    where b.id = p_business_id and b.owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.business_team_members tm
    join public.roles r on r.id = tm.role_id and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = tm.user_id and u.status = 'active'
    where tm.business_id = p_business_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and (r.business_id = p_business_id or r.business_id is null)
      and p.permission_key = p_permission_key
  );
$$;

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
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active'
  )
    and (b.owner_user_id = auth.uid()
      or exists (
        select 1 from public.business_team_members tm
        where tm.business_id = b.id and tm.user_id = auth.uid() and tm.status = 'active'
      ))
  order by b.created_at desc;
$$;

create or replace function public.list_public_businesses(
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_limit integer default 12
)
returns table (
  business_id uuid,
  business_name text,
  business_slug text,
  business_type text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  phone_e164 text,
  whatsapp_e164 text,
  latitude numeric,
  longitude numeric,
  last_updated_at timestamptz,
  distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.business_name,
    b.slug,
    bt.name,
    b.address_line1,
    b.address_line2,
    b.postal_code,
    b.phone_e164,
    b.whatsapp_e164,
    b.latitude,
    b.longitude,
    greatest(b.updated_at, coalesce(max(i.updated_at) filter (where iv.public_visible), b.updated_at)) as last_updated_at,
    case when p_latitude between -90 and 90 and p_longitude between -180 and 180
      and b.latitude is not null and b.longitude is not null then
        6371.0 * 2 * pg_catalog.asin(pg_catalog.sqrt(
          pg_catalog.power(pg_catalog.sin(pg_catalog.radians((b.latitude::double precision - p_latitude) / 2)), 2) +
          pg_catalog.cos(pg_catalog.radians(p_latitude)) *
          pg_catalog.cos(pg_catalog.radians(b.latitude::double precision)) *
          pg_catalog.power(pg_catalog.sin(pg_catalog.radians((b.longitude::double precision - p_longitude) / 2)), 2)
        ))
      else null end as distance_km
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  left join public.inventory i on i.business_id = b.id and i.status in ('available', 'low_stock')
  left join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
  where b.status = 'approved' and b.public_availability_enabled
    and exists (
      select 1
      from public.inventory public_i
      join public.inventory_visibility public_iv on public_iv.inventory_id = public_i.id and public_iv.public_visible
      join public.medicines public_m on public_m.id = public_i.medicine_id
        and public_m.status = 'approved' and public_m.public_visibility
      where public_i.business_id = b.id and public_i.status in ('available', 'low_stock')
    )
  group by b.id, bt.name
  order by distance_km asc nulls last, last_updated_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

create or replace function public.get_public_business_profile(p_business_slug text)
returns table (
  business_id uuid,
  business_name text,
  business_slug text,
  business_type text,
  description text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  phone_e164 text,
  whatsapp_e164 text,
  latitude numeric,
  longitude numeric,
  opening_hours jsonb,
  google_business_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.business_name, b.slug, bt.name, b.description, b.address_line1,
    b.address_line2, b.postal_code, b.phone_e164, b.whatsapp_e164,
    b.latitude, b.longitude, b.opening_hours, b.google_business_url
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  where b.slug = p_business_slug
    and b.status = 'approved'
    and b.public_availability_enabled;
$$;

create or replace function public.list_public_business_medicines(p_business_slug text)
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  inventory_status text,
  last_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.product_name, m.brand_name, c.name, m.strength, mf.name,
    i.status, i.updated_at
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  join public.inventory i on i.business_id = b.id and i.status in ('available', 'low_stock')
  join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
  join public.medicines m on m.id = i.medicine_id and m.status = 'approved' and m.public_visibility
  left join public.compositions c on c.id = m.composition_id and c.status = 'approved'
  left join public.manufacturers mf on mf.id = m.manufacturer_id and mf.status = 'approved'
  where b.slug = p_business_slug and b.status = 'approved' and b.public_availability_enabled
  order by m.normalized_product_name, m.strength;
$$;

create or replace function public.search_public_medicine(
  p_query text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_limit integer default 30,
  p_category_slug text default null
)
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  medicine_type text,
  prescription_class text,
  business_id uuid,
  business_name text,
  business_type text,
  business_slug text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  phone_e164 text,
  whatsapp_e164 text,
  latitude numeric,
  longitude numeric,
  inventory_status text,
  last_updated_at timestamptz,
  distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select
      m.id as medicine_id,
      m.product_name,
      m.brand_name,
      c.name as composition,
      m.strength,
      mf.name as manufacturer_name,
      m.medicine_type,
      m.prescription_class,
      b.id as business_id,
      b.business_name,
      bt.name as business_type,
      b.slug as business_slug,
      b.address_line1,
      b.address_line2,
      b.postal_code,
      b.phone_e164,
      b.whatsapp_e164,
      b.latitude,
      b.longitude,
      i.status as inventory_status,
      i.updated_at as last_updated_at,
      case when p_latitude between -90 and 90 and p_longitude between -180 and 180
        and b.latitude is not null and b.longitude is not null then
          6371.0 * 2 * pg_catalog.asin(pg_catalog.sqrt(
            pg_catalog.power(pg_catalog.sin(pg_catalog.radians((b.latitude::double precision - p_latitude) / 2)), 2) +
            pg_catalog.cos(pg_catalog.radians(p_latitude)) *
            pg_catalog.cos(pg_catalog.radians(b.latitude::double precision)) *
            pg_catalog.power(pg_catalog.sin(pg_catalog.radians((b.longitude::double precision - p_longitude) / 2)), 2)
          ))
        else null end as distance_km
    from public.inventory i
    join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
    join public.businesses b on b.id = i.business_id
      and b.status = 'approved' and b.public_availability_enabled
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    join public.medicines m on m.id = i.medicine_id
      and m.status = 'approved' and m.public_visibility
    left join public.compositions c on c.id = m.composition_id and c.status = 'approved'
    left join public.manufacturers mf on mf.id = m.manufacturer_id and mf.status = 'approved'
    where i.status in ('available', 'low_stock')
      and ((p_category_slug is not null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 0 and 120)
        or (p_category_slug is null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 2 and 120))
      and (p_category_slug is null or exists (
        select 1 from public.categories cat
        where cat.id = m.category_id and cat.slug = p_category_slug and cat.is_active
      ))
      and (pg_catalog.btrim(coalesce(p_query, '')) = '' or (
        pg_catalog.strpos(m.normalized_product_name, pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(m.brand_name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(c.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
        or pg_catalog.strpos(pg_catalog.lower(m.strength), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(mf.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      ))
  )
  select * from candidates
  order by distance_km asc nulls last, last_updated_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.bootstrap_dawasetu_user() from public, anon, authenticated;
revoke all on function public.has_platform_permission(text) from public;
revoke all on function public.is_active_business_member(uuid) from public;
revoke all on function public.has_business_permission(uuid, text) from public;
revoke all on function public.list_my_businesses() from public, anon;
revoke all on function public.list_public_businesses(double precision, double precision, integer) from public;
revoke all on function public.get_public_business_profile(text) from public;
revoke all on function public.list_public_business_medicines(text) from public;
revoke all on function public.search_public_medicine(text, double precision, double precision, integer, text) from public;
grant execute on function public.has_platform_permission(text) to anon, authenticated;
grant execute on function public.is_active_business_member(uuid) to anon, authenticated;
grant execute on function public.has_business_permission(uuid, text) to authenticated;
grant execute on function public.list_my_businesses() to authenticated;
grant execute on function public.list_public_businesses(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_public_business_profile(text) to anon, authenticated;
grant execute on function public.list_public_business_medicines(text) to anon, authenticated;
grant execute on function public.search_public_medicine(text, double precision, double precision, integer, text) to anon, authenticated;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.business_id is null and r.slug = 'admin'
on conflict do nothing;

with role_grants(role_slug, permission_key) as (
  values
    ('medicine_manager', 'dashboard.view'),
    ('medicine_manager', 'medicines.view'),
    ('medicine_manager', 'medicines.manage'),
    ('medicine_manager', 'medicines.approve'),
    ('partner_manager', 'dashboard.view'),
    ('partner_manager', 'partners.view'),
    ('partner_manager', 'partners.manage'),
    ('partner_manager', 'partners.approve'),
    ('partner_manager', 'inventory.view'),
    ('support_manager', 'dashboard.view'),
    ('support_manager', 'support.manage'),
    ('support_manager', 'requests.view'),
    ('finance_manager', 'dashboard.view'),
    ('finance_manager', 'payments.view'),
    ('finance_manager', 'payments.manage'),
    ('finance_manager', 'reports.view'),
    ('finance_manager', 'reports.export'),
    ('content_manager', 'dashboard.view'),
    ('content_manager', 'content.manage'),
    ('content_manager', 'promotions.manage')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from role_grants rg
join public.roles r on r.slug = rg.role_slug and r.business_id is null
join public.permissions p on p.permission_key = rg.permission_key
on conflict do nothing;

insert into public.categories (slug, name, display_order) values
  ('pain-relief', 'Pain Relief', 1),
  ('antibiotics', 'Antibiotics', 2),
  ('diabetes-care', 'Diabetes Care', 3),
  ('cardiac-care', 'Cardiac Care', 4),
  ('vitamins-supplements', 'Vitamins & Supplements', 5),
  ('respiratory-care', 'Respiratory Care', 6),
  ('gastro-care', 'Gastro Care', 7),
  ('skin-care', 'Skin Care', 8)
on conflict (slug) do nothing;

-- Explicit table grants keep the public schema closed. Public data is exposed only via
-- narrowly shaped RPCs and active lookup tables.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.business_types, public.states, public.districts, public.areas to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.subscription_plans, public.redirect_websites to anon, authenticated;
grant select on public.users to authenticated;
grant update (full_name, phone_e164, preferred_language) on public.users to authenticated;
grant select (id, business_type_id, business_name, slug, description, logo_path, phone_e164, whatsapp_e164, email, address_line1, address_line2, area_id, postal_code, latitude, longitude, opening_hours, public_availability_enabled, google_business_url, status, created_at, updated_at) on public.businesses to authenticated;
grant delete on public.businesses to authenticated;
grant insert (owner_user_id, business_type_id, business_name, slug, registration_number, description, logo_path, phone_e164, whatsapp_e164, email, address_line1, address_line2, area_id, postal_code, latitude, longitude, opening_hours, public_availability_enabled, google_business_url, status) on public.businesses to authenticated;
grant update (business_name, description, logo_path, phone_e164, whatsapp_e164, email, address_line1, address_line2, area_id, postal_code, latitude, longitude, opening_hours, public_availability_enabled, google_business_url) on public.businesses to authenticated;
grant select, insert, update, delete on public.inventory, public.inventory_visibility to authenticated;
grant select on public.medicine_requests to authenticated;
grant insert (customer_user_id, medicine_id, requested_medicine_name, composition_text, strength, quantity, customer_area_id, customer_latitude, customer_longitude, contact_preference, contact_phone_e164, note) on public.medicine_requests to authenticated;
grant select, insert, update on public.medicine_request_responses to authenticated;
grant select, insert on public.orders to authenticated;
grant update (status, partner_note) on public.orders to authenticated;
grant select, insert on public.inquiries to authenticated;
grant update (status) on public.inquiries to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.reviews to authenticated;
grant update (rating, review_text) on public.reviews to authenticated;
grant select on public.support_tickets to authenticated;
grant insert (requester_user_id, business_id, category, subject, description, attachment_path, priority) on public.support_tickets to authenticated;
grant update (description, attachment_path, status) on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;
grant insert (ticket_id, author_user_id, message, attachment_path) on public.support_ticket_messages to authenticated;

create policy "lookup tables are readable" on public.business_types for select to anon, authenticated using (is_active);
create policy "active medicine categories are readable" on public.categories for select to anon, authenticated using (is_active);
create policy "active states are readable" on public.states for select to anon, authenticated using (is_active);
create policy "active districts are readable" on public.districts for select to anon, authenticated using (is_active);
create policy "active areas are readable" on public.areas for select to anon, authenticated using (is_active);
create policy "active plans are readable" on public.subscription_plans for select to anon, authenticated using (is_active);
create policy "active redirect websites are readable" on public.redirect_websites for select to anon, authenticated using (is_active);

create policy "users can view own profile" on public.users for select to authenticated using (id = auth.uid());
create policy "users can update own profile" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "business owners and public profiles are readable" on public.businesses for select to anon, authenticated using (
  (status = 'approved' and public_availability_enabled and exists (
    select 1 from public.business_types bt where bt.id = business_type_id and not bt.is_distributor
  ))
  or (auth.uid() is not null and (owner_user_id = auth.uid() or public.is_active_business_member(id)))
  or public.has_platform_permission('partners.view')
);
create policy "approved partners can register own business" on public.businesses for insert to authenticated with check (
  owner_user_id = auth.uid() and status = 'pending'
  and public.has_platform_permission('partners.manage') = false
);
create policy "business managers can update own business" on public.businesses for update to authenticated using (
  public.has_business_permission(id, 'partners.manage') or public.has_platform_permission('partners.manage')
) with check (
  public.has_business_permission(id, 'partners.manage') or public.has_platform_permission('partners.manage')
);
create policy "platform managers can delete businesses" on public.businesses for delete to authenticated using (
  public.has_platform_permission('partners.manage')
);

create policy "business members read inventory" on public.inventory for select to authenticated using (
  public.is_active_business_member(business_id) or public.has_platform_permission('inventory.view')
);
create policy "business managers add inventory" on public.inventory for insert to authenticated with check (
  public.has_business_permission(business_id, 'inventory.manage') or public.has_platform_permission('inventory.manage')
);
create policy "business managers update inventory" on public.inventory for update to authenticated using (
  public.has_business_permission(business_id, 'inventory.manage') or public.has_platform_permission('inventory.manage')
) with check (
  public.has_business_permission(business_id, 'inventory.manage') or public.has_platform_permission('inventory.manage')
);
create policy "authorized managers delete inventory" on public.inventory for delete to authenticated using (
  public.has_platform_permission('inventory.manage')
);
create policy "business members read inventory visibility" on public.inventory_visibility for select to authenticated using (
  exists (select 1 from public.inventory i where i.id = inventory_id and public.is_active_business_member(i.business_id))
  or public.has_platform_permission('inventory.view')
);
create policy "business managers add inventory visibility" on public.inventory_visibility for insert to authenticated with check (
  exists (select 1 from public.inventory i where i.id = inventory_id and public.has_business_permission(i.business_id, 'inventory.manage'))
  or public.has_platform_permission('inventory.manage')
);
create policy "business managers update inventory visibility" on public.inventory_visibility for update to authenticated using (
  exists (select 1 from public.inventory i where i.id = inventory_id and public.has_business_permission(i.business_id, 'inventory.manage'))
  or public.has_platform_permission('inventory.manage')
) with check (
  exists (select 1 from public.inventory i where i.id = inventory_id and public.has_business_permission(i.business_id, 'inventory.manage'))
  or public.has_platform_permission('inventory.manage')
);
create policy "platform managers delete inventory visibility" on public.inventory_visibility for delete to authenticated using (
  public.has_platform_permission('inventory.manage')
);

create policy "customers view own medicine requests" on public.medicine_requests for select to authenticated using (
  customer_user_id = auth.uid() or public.has_platform_permission('requests.view')
);
create policy "customers create own medicine requests" on public.medicine_requests for insert to authenticated with check (
  customer_user_id = auth.uid() and status = 'open'
);
create policy "customers view own request responses" on public.medicine_request_responses for select to authenticated using (
  exists (select 1 from public.medicine_requests mr where mr.id = request_id and mr.customer_user_id = auth.uid())
  or public.has_business_permission(business_id, 'requests.view')
  or public.has_platform_permission('requests.view')
);
create policy "businesses respond to requests" on public.medicine_request_responses for insert to authenticated with check (
  public.has_business_permission(business_id, 'requests.respond')
  and exists (select 1 from public.medicine_requests mr where mr.id = request_id and mr.status in ('open', 'partially_fulfilled') and mr.expires_at > now())
);
create policy "businesses update own request responses" on public.medicine_request_responses for update to authenticated using (
  public.has_business_permission(business_id, 'requests.respond')
) with check (public.has_business_permission(business_id, 'requests.respond'));

create policy "order participants read orders" on public.orders for select to authenticated using (
  customer_user_id = auth.uid() or public.has_business_permission(business_id, 'requests.view') or public.has_platform_permission('requests.view')
);
create policy "customers create orders" on public.orders for insert to authenticated with check (
  customer_user_id = auth.uid() and status = 'inquiry'
);
create policy "business managers update orders" on public.orders for update to authenticated using (
  public.has_business_permission(business_id, 'requests.respond') or public.has_platform_permission('requests.respond')
) with check (
  public.has_business_permission(business_id, 'requests.respond') or public.has_platform_permission('requests.respond')
);
create policy "inquiry participants read inquiries" on public.inquiries for select to authenticated using (
  customer_user_id = auth.uid() or public.has_business_permission(business_id, 'requests.view') or public.has_platform_permission('requests.view')
);
create policy "customers create inquiries" on public.inquiries for insert to authenticated with check (
  customer_user_id = auth.uid() and status = 'open'
);
create policy "business managers update inquiries" on public.inquiries for update to authenticated using (
  public.has_business_permission(business_id, 'requests.respond') or public.has_platform_permission('requests.respond')
) with check (
  public.has_business_permission(business_id, 'requests.respond') or public.has_platform_permission('requests.respond')
);

create policy "users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read approved reviews" on public.reviews for select to anon, authenticated using (
  status = 'approved' or customer_user_id = auth.uid()
);
create policy "customers create own reviews" on public.reviews for insert to authenticated with check (
  customer_user_id = auth.uid() and status = 'pending'
);
create policy "customers update own pending reviews" on public.reviews for update to authenticated using (
  customer_user_id = auth.uid() and status = 'pending'
) with check (customer_user_id = auth.uid() and status = 'pending');

create policy "requesters view own support tickets" on public.support_tickets for select to authenticated using (
  requester_user_id = auth.uid() or public.has_platform_permission('support.manage')
);
create policy "users create own support tickets" on public.support_tickets for insert to authenticated with check (
  requester_user_id = auth.uid() and status = 'open'
);
create policy "requesters update own open tickets" on public.support_tickets for update to authenticated using (
  requester_user_id = auth.uid() and status in ('open', 'waiting')
) with check (requester_user_id = auth.uid() and status in ('open', 'waiting'));
create policy "ticket participants read messages" on public.support_ticket_messages for select to authenticated using (
  exists (select 1 from public.support_tickets st where st.id = ticket_id and (st.requester_user_id = auth.uid() or public.has_platform_permission('support.manage')))
  and (not is_internal or public.has_platform_permission('support.manage'))
);
create policy "users add public ticket messages" on public.support_ticket_messages for insert to authenticated with check (
  author_user_id = auth.uid() and not is_internal
  and exists (select 1 from public.support_tickets st where st.id = ticket_id and st.requester_user_id = auth.uid())
);

-- Distributor stock is not included in the public search RPC and is inaccessible to anon.
-- No authenticated direct read policy is created for catalog master tables, payments,
-- subscriptions, roles, permissions, audit logs, security settings, or distributor inventory.
