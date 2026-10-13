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
      and (
        (p_category_slug is not null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 0 and 120)
        or (p_category_slug is null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 2 and 120)
        or (
          p_category_slug is null
          and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) = 0
          and p_latitude between -90 and 90
          and p_longitude between -180 and 180
        )
      )
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
