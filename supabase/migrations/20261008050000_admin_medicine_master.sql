-- Admin medicine workflows are available only through permission-checked RPCs.
alter table public.medicines add column if not exists review_note text;

create or replace function public.admin_list_medicines(
  p_query text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
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
  public_visibility boolean,
  medicine_status text,
  review_note text,
  submitted_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('medicines.view')
    and not public.has_platform_permission('medicines.manage')
    and not public.has_platform_permission('medicines.approve') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) > 120
    or (p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'inactive'))
    or p_limit not between 1 and 100 or p_offset < 0 then
    raise exception 'Invalid search filters';
  end if;
  return query
    select m.id, m.product_name, m.brand_name, c.name, m.strength, mf.name,
      cat.name, m.medicine_type, m.prescription_class, m.packaging,
      m.public_visibility, m.status, m.review_note, m.submitted_by, m.created_at, m.updated_at
    from public.medicines m
    left join public.compositions c on c.id = m.composition_id
    left join public.manufacturers mf on mf.id = m.manufacturer_id
    left join public.categories cat on cat.id = m.category_id
    where (p_status is null or m.status = p_status)
      and (pg_catalog.btrim(coalesce(p_query, '')) = ''
        or m.normalized_product_name like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(m.brand_name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(c.name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(m.strength) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
        or pg_catalog.lower(coalesce(mf.name, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%')
    order by case when m.status = 'pending' then 0 else 1 end, m.updated_at desc
    limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_get_medicine(p_medicine_id uuid)
returns table (
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  manufacturer_name text,
  category_id uuid,
  medicine_type text,
  prescription_class text,
  packaging text,
  public_visibility boolean,
  medicine_status text,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('medicines.view') and not public.has_platform_permission('medicines.manage') then
    raise exception 'Permission denied';
  end if;
  return query select m.id, m.product_name, m.brand_name, c.name, m.strength,
    mf.name, m.category_id, m.medicine_type, m.prescription_class, m.packaging,
    m.public_visibility, m.status, m.review_note
  from public.medicines m
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  where m.id = p_medicine_id;
end;
$$;

create or replace function public.get_admin_dashboard_summary()
returns table (
  total_users bigint,
  total_partners bigint,
  pending_partners bigint,
  total_requests bigint,
  active_medicines bigint,
  total_orders bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('dashboard.view') then raise exception 'Permission denied'; end if;
  return query select
    (select count(*) from public.users),
    (select count(*) from public.businesses b join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor),
    (select count(*) from public.businesses b join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor where b.status = 'pending'),
    (select count(*) from public.medicine_requests),
    (select count(*) from public.medicines where status = 'approved'),
    (select count(*) from public.orders);
end;
$$;

create or replace function public.admin_save_medicine(
  p_medicine_id uuid,
  p_product_name text,
  p_brand_name text,
  p_composition text,
  p_strength text,
  p_manufacturer text,
  p_category_id uuid,
  p_medicine_type text,
  p_prescription_class text,
  p_packaging text,
  p_public_visibility boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_composition_id uuid;
  v_manufacturer_id uuid;
  v_previous jsonb;
  v_new jsonb;
  v_product text := pg_catalog.btrim(coalesce(p_product_name, ''));
  v_composition text := pg_catalog.btrim(coalesce(p_composition, ''));
  v_strength text := pg_catalog.btrim(coalesce(p_strength, ''));
  v_manufacturer text := pg_catalog.btrim(coalesce(p_manufacturer, ''));
begin
  if not public.has_platform_permission('medicines.manage') then raise exception 'Permission denied'; end if;
  if pg_catalog.length(v_product) not between 1 and 240
    or pg_catalog.length(coalesce(p_brand_name, '')) > 240
    or pg_catalog.length(v_composition) not between 2 and 240
    or pg_catalog.length(v_strength) not between 1 and 120
    or pg_catalog.length(v_manufacturer) not between 2 and 200
    or pg_catalog.length(coalesce(p_packaging, '')) > 160
    or p_medicine_type is null
    or p_medicine_type not in ('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'device', 'other')
    or p_prescription_class is null
    or p_prescription_class not in ('prescription', 'otc', 'unknown') then
    raise exception 'Invalid medicine details';
  end if;
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id and is_active) then
    raise exception 'Invalid category';
  end if;
  if p_medicine_id is not null then
    select pg_catalog.to_jsonb(m) into v_previous from public.medicines m where m.id = p_medicine_id;
    if v_previous is null then raise exception 'Medicine not found'; end if;
  end if;

  insert into public.compositions (name, status) values (v_composition, 'pending')
    on conflict (normalized_name) do nothing;
  select id into v_composition_id from public.compositions where normalized_name = pg_catalog.lower(v_composition);
  insert into public.manufacturers (name, status) values (v_manufacturer, 'pending')
    on conflict (normalized_name) do nothing;
  select id into v_manufacturer_id from public.manufacturers where normalized_name = pg_catalog.lower(v_manufacturer);

  if p_medicine_id is null then
    insert into public.medicines (
      product_name, brand_name, composition_id, strength, manufacturer_id, category_id,
      medicine_type, prescription_class, packaging, public_visibility, status, submitted_by
    ) values (
      v_product, nullif(pg_catalog.btrim(p_brand_name), ''), v_composition_id, v_strength,
      v_manufacturer_id, p_category_id, p_medicine_type, p_prescription_class,
      nullif(pg_catalog.btrim(p_packaging), ''), coalesce(p_public_visibility, true), 'pending', auth.uid()
    ) returning id into v_id;
  else
    update public.medicines set
      product_name = v_product, brand_name = nullif(pg_catalog.btrim(p_brand_name), ''),
      composition_id = v_composition_id, strength = v_strength, manufacturer_id = v_manufacturer_id,
      category_id = p_category_id, medicine_type = p_medicine_type,
      prescription_class = p_prescription_class, packaging = nullif(pg_catalog.btrim(p_packaging), ''),
      public_visibility = coalesce(p_public_visibility, true), status = 'pending', review_note = null,
      reviewed_by = null, reviewed_at = null, updated_at = pg_catalog.now()
    where id = p_medicine_id returning id into v_id;
  end if;
  select pg_catalog.to_jsonb(m) into v_new from public.medicines m where m.id = v_id;
  insert into public.audit_logs (actor_user_id, role_slug, action, module, record_table, record_id, previous_value, new_value)
  values (auth.uid(), coalesce((select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and ur.business_id is null order by r.slug limit 1), 'unknown'), case when p_medicine_id is null then 'create' else 'update' end,
    'medicines', 'medicines', v_id, v_previous, v_new);
  return v_id;
end;
$$;

create or replace function public.admin_review_medicine(
  p_medicine_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_medicine public.medicines%rowtype;
  v_previous jsonb;
  v_new jsonb;
begin
  if not public.has_platform_permission('medicines.approve') then raise exception 'Permission denied'; end if;
  if p_decision not in ('approved', 'rejected') or pg_catalog.length(coalesce(p_note, '')) > 1000 then
    raise exception 'Invalid review decision';
  end if;
  select * into v_medicine from public.medicines where id = p_medicine_id for update;
  if not found or v_medicine.status not in ('pending', 'rejected') then raise exception 'Medicine is not reviewable'; end if;
  v_previous := pg_catalog.to_jsonb(v_medicine);
  update public.medicines set status = p_decision, review_note = nullif(pg_catalog.btrim(p_note), ''),
    reviewed_by = auth.uid(), reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_medicine_id returning * into v_medicine;
  if p_decision = 'approved' then
    update public.compositions set status = 'approved', updated_at = pg_catalog.now() where id = v_medicine.composition_id;
    update public.manufacturers set status = 'approved', updated_at = pg_catalog.now() where id = v_medicine.manufacturer_id;
  end if;
  v_new := pg_catalog.to_jsonb(v_medicine);
  insert into public.audit_logs (actor_user_id, role_slug, action, module, record_table, record_id, previous_value, new_value)
  values (auth.uid(), coalesce((select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and ur.business_id is null order by r.slug limit 1), 'unknown'), p_decision, 'medicines', 'medicines', p_medicine_id, v_previous, v_new);
  return p_medicine_id;
end;
$$;

revoke all on function public.admin_list_medicines(text, text, integer, integer) from public, anon;
revoke all on function public.admin_get_medicine(uuid) from public, anon;
revoke all on function public.get_admin_dashboard_summary() from public, anon;
revoke all on function public.admin_save_medicine(uuid, text, text, text, text, text, uuid, text, text, text, boolean) from public, anon;
revoke all on function public.admin_review_medicine(uuid, text, text) from public, anon;
grant execute on function public.admin_list_medicines(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_medicine(uuid) to authenticated;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
grant execute on function public.admin_save_medicine(uuid, text, text, text, text, text, uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_review_medicine(uuid, text, text) to authenticated;
