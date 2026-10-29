-- Search terms such as "Pantop 40" span the brand/product and strength
-- columns. Match each word across all searchable fields instead of requiring
-- the whole phrase to occur inside one field.
create or replace function public.medicine_search_matches_query(
  p_query text,
  p_product_name text,
  p_brand_name text,
  p_composition text,
  p_strength text,
  p_manufacturer text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with normalized_query as (
    select pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, ''))),
      '[^[:alnum:]]+',
      ' ',
      'g'
    ) as value
  ),
  search_terms as (
    select term.value
    from normalized_query query
    cross join lateral pg_catalog.regexp_split_to_table(
      query.value,
      '[[:space:]]+'
    ) as term(value)
    where term.value <> ''
  ),
  searchable_values as (
    select
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_product_name, '')), '[^[:alnum:]]+', ' ', 'g') as product_name,
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_brand_name, '')), '[^[:alnum:]]+', ' ', 'g') as brand_name,
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_composition, '')), '[^[:alnum:]]+', ' ', 'g') as composition,
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_strength, '')), '[^[:alnum:]]+', ' ', 'g') as strength,
      pg_catalog.regexp_replace(pg_catalog.lower(coalesce(p_manufacturer, '')), '[^[:alnum:]]+', ' ', 'g') as manufacturer
  )
  select pg_catalog.btrim(coalesce(p_query, '')) = ''
    or (
      (select pg_catalog.count(*) from search_terms) between 1 and 8
      and not exists (
        select 1
        from search_terms term
        cross join searchable_values searchable
        where pg_catalog.strpos(searchable.product_name, term.value) = 0
          and pg_catalog.strpos(searchable.brand_name, term.value) = 0
          and pg_catalog.strpos(searchable.composition, term.value) = 0
          and pg_catalog.strpos(searchable.strength, term.value) = 0
          and pg_catalog.strpos(searchable.manufacturer, term.value) = 0
      )
    );
$$;

revoke all on function public.medicine_search_matches_query(text, text, text, text, text, text)
  from public, anon, authenticated;

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
      and public.medicine_search_matches_query(
        p_query, m.product_name, m.brand_name, c.name, m.strength, mf.name
      )
  )
  select * from candidates
  order by distance_km asc nulls last, last_updated_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
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
  select
    m.id,
    m.product_name,
    m.brand_name,
    case when c.status = 'approved' then c.name else null end,
    m.strength,
    case when mf.status = 'approved' then mf.name else null end,
    m.medicine_type,
    m.prescription_class
  from public.medicines m
  left join public.compositions c on c.id = m.composition_id
  left join public.manufacturers mf on mf.id = m.manufacturer_id
  where m.status = 'approved'
    and m.public_visibility
    and (
      (p_category_slug is null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 2 and 120)
      or (p_category_slug is not null and pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) between 0 and 120)
    )
    and (p_category_slug is null or exists (
      select 1 from public.categories cat
      where cat.id = m.category_id and cat.slug = p_category_slug and cat.is_active
    ))
    and public.medicine_search_matches_query(
      p_query, m.product_name, m.brand_name, c.name, m.strength, mf.name
    )
  order by m.normalized_product_name, m.strength
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

-- Preserve the existing public RPC grants on both search functions.
grant execute on function public.search_public_medicine(text, double precision, double precision, integer, text)
  to anon, authenticated;
grant execute on function public.search_public_medicine_catalog(text, integer, text)
  to anon, authenticated;
