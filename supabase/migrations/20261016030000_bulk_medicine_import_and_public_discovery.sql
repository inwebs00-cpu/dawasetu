-- Make approved public partner profiles discoverable without requiring a
-- medicine stock row. Medicine availability itself remains separately gated
-- by approved medicine, business and inventory visibility checks.
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
    greatest(
      b.updated_at,
      coalesce((
        select max(i.updated_at)
        from public.inventory i
        join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
        join public.medicines m on m.id = i.medicine_id
          and m.status = 'approved' and m.public_visibility
        where i.business_id = b.id and i.status in ('available', 'low_stock')
      ), b.updated_at)
    ) as last_updated_at,
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
  where b.status = 'approved' and b.public_availability_enabled
  order by distance_km asc nulls last, last_updated_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

create or replace function public.admin_bulk_import_medicines(p_records jsonb)
returns table (
  row_number integer,
  medicine_id uuid,
  result text,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record jsonb;
  v_line integer;
  v_index integer := 0;
  v_product text;
  v_brand text;
  v_composition text;
  v_strength text;
  v_manufacturer text;
  v_category_slug text;
  v_category_id uuid;
  v_medicine_type text;
  v_prescription_class text;
  v_packaging text;
  v_public_visibility boolean;
  v_id uuid;
begin
  if not public.has_platform_permission('medicines.manage') then
    raise exception 'Permission denied';
  end if;
  if p_records is null or pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'Invalid medicine import batch';
  end if;
  if pg_catalog.jsonb_array_length(p_records) not between 1 and 500 then
    raise exception 'Invalid medicine import batch';
  end if;

  for v_record in select value from pg_catalog.jsonb_array_elements(p_records)
  loop
    v_index := v_index + 1;
    v_line := v_index + 1;
    if pg_catalog.jsonb_typeof(v_record) <> 'object' then
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Row must contain named medicine fields.'; return next; continue;
    end if;
    if coalesce(v_record ->> 'row_number', '') ~ '^[0-9]{1,5}$' then
      v_line := (v_record ->> 'row_number')::integer;
    end if;
    v_product := pg_catalog.btrim(coalesce(v_record ->> 'product_name', ''));
    v_brand := pg_catalog.btrim(coalesce(v_record ->> 'brand_name', ''));
    v_composition := pg_catalog.btrim(coalesce(v_record ->> 'composition', ''));
    v_strength := pg_catalog.btrim(coalesce(v_record ->> 'strength', ''));
    v_manufacturer := pg_catalog.btrim(coalesce(v_record ->> 'manufacturer', ''));
    v_category_slug := pg_catalog.btrim(coalesce(v_record ->> 'category_slug', ''));
    v_medicine_type := coalesce(nullif(pg_catalog.btrim(v_record ->> 'medicine_type'), ''), 'tablet');
    v_prescription_class := coalesce(nullif(pg_catalog.btrim(v_record ->> 'prescription_class'), ''), 'unknown');
    v_packaging := pg_catalog.btrim(coalesce(v_record ->> 'packaging', ''));
    if nullif(pg_catalog.btrim(v_record ->> 'public_visibility'), '') is null then
      v_public_visibility := true;
    elsif pg_catalog.lower(pg_catalog.btrim(v_record ->> 'public_visibility')) in ('true', 'yes', '1') then
      v_public_visibility := true;
    elsif pg_catalog.lower(pg_catalog.btrim(v_record ->> 'public_visibility')) in ('false', 'no', '0') then
      v_public_visibility := false;
    else
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Public visibility must be true/false, yes/no or 1/0.'; return next; continue;
    end if;

    if pg_catalog.length(v_product) not between 1 and 240
      or pg_catalog.length(v_brand) > 240
      or pg_catalog.length(v_composition) not between 2 and 240
      or pg_catalog.length(v_strength) not between 1 and 120
      or pg_catalog.length(v_manufacturer) not between 2 and 200
      or pg_catalog.length(v_packaging) > 160
      or v_medicine_type not in ('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'device', 'other')
      or v_prescription_class not in ('prescription', 'otc', 'unknown') then
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Required fields or medicine classification are invalid.'; return next; continue;
    end if;

    v_category_id := null;
    if v_category_slug <> '' then
      select c.id into v_category_id from public.categories c
      where c.slug = v_category_slug and c.is_active;
      if v_category_id is null then
        row_number := v_line; medicine_id := null; result := 'error';
        message := 'Category slug does not match an active category.'; return next; continue;
      end if;
    end if;

    if exists (
      select 1 from public.medicines m
      join public.manufacturers mf on mf.id = m.manufacturer_id
      where m.normalized_product_name = pg_catalog.lower(v_product)
        and m.strength = v_strength
        and mf.normalized_name = pg_catalog.lower(v_manufacturer)
    ) then
      row_number := v_line; medicine_id := null; result := 'duplicate';
      message := 'This product, strength and manufacturer already exist.'; return next; continue;
    end if;

    begin
      v_id := public.admin_save_medicine(
        null, v_product, nullif(v_brand, ''), v_composition, v_strength,
        v_manufacturer, v_category_id, v_medicine_type,
        v_prescription_class, nullif(v_packaging, ''), v_public_visibility
      );
      row_number := v_line; medicine_id := v_id; result := 'imported';
      message := 'Added to the medicine master as pending review.'; return next;
    exception
      when unique_violation then
        row_number := v_line; medicine_id := null; result := 'duplicate';
        message := 'This product, strength and manufacturer already exist.'; return next;
      when others then
        row_number := v_line; medicine_id := null; result := 'error';
        message := 'This row could not be imported. Check the fields and try again.'; return next;
    end;
  end loop;
end;
$$;

create or replace function public.partner_bulk_upsert_inventory(
  p_business_id uuid,
  p_records jsonb
)
returns table (
  row_number integer,
  medicine_id uuid,
  result text,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record jsonb;
  v_line integer;
  v_index integer := 0;
  v_product text;
  v_strength text;
  v_manufacturer text;
  v_status text;
  v_quantity integer;
  v_public_visible boolean;
  v_candidate_count integer;
  v_medicine_id uuid;
  v_business_type_slug text;
begin
  if not public.has_business_permission(p_business_id, 'inventory.manage') then
    raise exception 'Permission denied';
  end if;
  select bt.slug into v_business_type_slug
  from public.businesses b join public.business_types bt on bt.id = b.business_type_id
  where b.id = p_business_id;
  if v_business_type_slug is null or v_business_type_slug not in ('retail_pharmacy', 'clinic_pharmacy', 'nursing_home_pharmacy') then
    raise exception 'Bulk medicine inventory is available to pharmacy and care partners only';
  end if;
  if p_records is null or pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'Invalid inventory import batch';
  end if;
  if pg_catalog.jsonb_array_length(p_records) not between 1 and 500 then
    raise exception 'Invalid inventory import batch';
  end if;

  for v_record in select value from pg_catalog.jsonb_array_elements(p_records)
  loop
    v_index := v_index + 1;
    v_line := v_index + 1;
    if pg_catalog.jsonb_typeof(v_record) <> 'object' then
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Row must contain named inventory fields.'; return next; continue;
    end if;
    if coalesce(v_record ->> 'row_number', '') ~ '^[0-9]{1,5}$' then
      v_line := (v_record ->> 'row_number')::integer;
    end if;
    v_product := pg_catalog.btrim(coalesce(v_record ->> 'product_name', ''));
    v_strength := pg_catalog.btrim(coalesce(v_record ->> 'strength', ''));
    v_manufacturer := pg_catalog.btrim(coalesce(v_record ->> 'manufacturer', ''));
    v_status := coalesce(nullif(pg_catalog.lower(pg_catalog.btrim(v_record ->> 'status')), ''), 'available');
    if nullif(pg_catalog.btrim(v_record ->> 'public_visible'), '') is null then
      v_public_visible := true;
    elsif pg_catalog.lower(pg_catalog.btrim(v_record ->> 'public_visible')) in ('true', 'yes', '1') then
      v_public_visible := true;
    elsif pg_catalog.lower(pg_catalog.btrim(v_record ->> 'public_visible')) in ('false', 'no', '0') then
      v_public_visible := false;
    else
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Public visibility must be true/false, yes/no or 1/0.'; return next; continue;
    end if;
    v_quantity := null;

    if pg_catalog.length(v_product) not between 1 and 240
      or pg_catalog.length(v_strength) not between 1 and 120
      or pg_catalog.length(v_manufacturer) > 200 then
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Enter a product name and strength; manufacturer is optional.'; return next; continue;
    end if;
    if v_status not in ('available', 'low_stock', 'out_of_stock') then
      row_number := v_line; medicine_id := null; result := 'error';
      message := 'Status must be available, low_stock or out_of_stock.'; return next; continue;
    end if;
    if nullif(pg_catalog.btrim(v_record ->> 'quantity'), '') is not null then
      if pg_catalog.btrim(v_record ->> 'quantity') !~ '^[0-9]{1,7}$' then
        row_number := v_line; medicine_id := null; result := 'error';
        message := 'Quantity must be a whole number from 0 to 1,000,000.'; return next; continue;
      end if;
      v_quantity := (v_record ->> 'quantity')::integer;
      if v_quantity > 1000000 or (v_quantity = 0 and v_status <> 'out_of_stock') then
        row_number := v_line; medicine_id := null; result := 'error';
        message := 'Zero quantity must be marked out_of_stock.'; return next; continue;
      end if;
    end if;

    select count(*)::integer into v_candidate_count
    from public.medicines m
    left join public.manufacturers mf on mf.id = m.manufacturer_id
    where m.status = 'approved'
      and pg_catalog.lower(pg_catalog.btrim(m.strength)) = pg_catalog.lower(v_strength)
      and (m.normalized_product_name = pg_catalog.lower(v_product)
        or pg_catalog.lower(pg_catalog.btrim(coalesce(m.brand_name, ''))) = pg_catalog.lower(v_product))
      and (v_manufacturer = '' or pg_catalog.lower(pg_catalog.btrim(coalesce(mf.name, ''))) = pg_catalog.lower(v_manufacturer));
    if v_candidate_count = 0 then
      row_number := v_line; medicine_id := null; result := 'not_found';
      message := 'No approved exact match in the medicine master; ask admin to add or approve it.'; return next; continue;
    elsif v_candidate_count > 1 then
      row_number := v_line; medicine_id := null; result := 'ambiguous';
      message := 'More than one approved product matches; include the exact manufacturer.'; return next; continue;
    end if;

    select m.id into v_medicine_id
    from public.medicines m
    left join public.manufacturers mf on mf.id = m.manufacturer_id
    where m.status = 'approved'
      and pg_catalog.lower(pg_catalog.btrim(m.strength)) = pg_catalog.lower(v_strength)
      and (m.normalized_product_name = pg_catalog.lower(v_product)
        or pg_catalog.lower(pg_catalog.btrim(coalesce(m.brand_name, ''))) = pg_catalog.lower(v_product))
      and (v_manufacturer = '' or pg_catalog.lower(pg_catalog.btrim(coalesce(mf.name, ''))) = pg_catalog.lower(v_manufacturer))
    limit 1;

    begin
      perform public.upsert_partner_inventory(
        p_business_id, v_medicine_id, v_status, v_quantity, v_public_visible
      );
      row_number := v_line; medicine_id := v_medicine_id; result := 'imported';
      message := 'Inventory availability updated.'; return next;
    exception
      when others then
        row_number := v_line; medicine_id := null; result := 'error';
        message := 'This row could not be imported. Check the fields and try again.'; return next;
    end;
  end loop;
end;
$$;

create or replace function public.search_public_medicine_catalog(
  p_query text,
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
  prescription_class text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.product_name, m.brand_name,
    case when c.status = 'approved' then c.name else null end,
    m.strength,
    case when mf.status = 'approved' then mf.name else null end,
    m.medicine_type, m.prescription_class
  from public.medicines m
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  where m.status = 'approved' and m.public_visibility
    and ((p_category_slug is null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 2 and 120)
      or (p_category_slug is not null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 0 and 120))
    and (p_category_slug is null or exists (
      select 1 from public.categories cat
      where cat.id = m.category_id and cat.slug = p_category_slug and cat.is_active
    ))
    and (pg_catalog.btrim(coalesce(p_query, '')) = '' or
      pg_catalog.strpos(m.normalized_product_name, pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(m.brand_name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(c.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(m.strength), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(mf.name, '')), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0)
  order by m.normalized_product_name, m.strength
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.admin_bulk_import_medicines(jsonb) from public, anon;
revoke all on function public.partner_bulk_upsert_inventory(uuid, jsonb) from public, anon;
revoke all on function public.search_public_medicine_catalog(text, integer, text) from public;
grant execute on function public.admin_bulk_import_medicines(jsonb) to authenticated;
grant execute on function public.partner_bulk_upsert_inventory(uuid, jsonb) to authenticated;
grant execute on function public.search_public_medicine_catalog(text, integer, text) to anon, authenticated;

revoke all on function public.list_public_businesses(double precision, double precision, integer) from public;
grant execute on function public.list_public_businesses(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.search_public_medicine(text, double precision, double precision, integer, text) to anon, authenticated;
