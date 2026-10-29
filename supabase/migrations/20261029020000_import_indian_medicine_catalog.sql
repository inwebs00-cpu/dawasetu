-- A catalog import is not an availability report and does not infer legal
-- prescription schedules. Imported products remain explicitly unclassified
-- until an authorized reviewer verifies the current Indian label/rule.

create table if not exists public.medicine_catalog_import_20261029 (
  source_key text primary key,
  product_name text not null,
  brand_name text,
  composition text,
  strength text not null,
  source_primary_strength text,
  manufacturer text,
  category_slug text,
  medicine_type text not null,
  prescription_class text not null default 'unknown',
  packaging text,
  public_visibility boolean not null default false,
  source_is_discontinued boolean not null default false,
  source_therapeutic_class text,
  source_row_count integer not null default 1,
  source_ids text,
  source_flags text
);

alter table public.medicine_catalog_import_20261029 enable row level security;
revoke all on public.medicine_catalog_import_20261029 from anon, authenticated;

alter table public.medicines
  add column if not exists catalog_source_key text,
  add column if not exists catalog_source_flags text,
  add column if not exists regulatory_schedule text[] not null default '{}',
  add column if not exists regulatory_schedule_verified_at timestamptz;

create unique index if not exists medicines_catalog_source_key_uidx
  on public.medicines (catalog_source_key)
  where catalog_source_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'medicines_regulatory_schedule_valid'
      and conrelid = 'public.medicines'::regclass
  ) then
    alter table public.medicines
      add constraint medicines_regulatory_schedule_valid
      check (regulatory_schedule <@ array['H', 'H1', 'X', 'NRx']::text[]);
  end if;
end;
$$;

create or replace function public.import_indian_medicine_catalog_20261029()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer := 0;
  v_count integer := 0;
begin
  -- Category slugs are sourced from the supplied catalog; unknown slugs get a
  -- readable label and remain ordinary browsing categories.
  insert into public.categories (slug, name, is_active)
  select distinct s.category_slug,
    initcap(replace(s.category_slug, '-', ' ')), true
  from public.medicine_catalog_import_20261029 s
  where nullif(trim(s.category_slug), '') is not null
    and s.category_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  on conflict (slug) do nothing;

  insert into public.compositions (name, status)
  select distinct trim(s.composition), 'approved'
  from public.medicine_catalog_import_20261029 s
  where nullif(trim(s.composition), '') is not null
  on conflict (normalized_name) do nothing;

  insert into public.manufacturers (name, status)
  select distinct trim(s.manufacturer), 'approved'
  from public.medicine_catalog_import_20261029 s
  where nullif(trim(s.manufacturer), '') is not null
  on conflict (normalized_name) do nothing;

  -- Attach source keys to exact pre-existing natural-key matches so retries
  -- update those rows instead of creating duplicate medicines.
  update public.medicines m
  set catalog_source_key = s.source_key,
      catalog_source_flags = nullif(s.source_flags, ''),
      brand_name = nullif(trim(s.brand_name), ''),
      composition_id = c.id,
      category_id = cat.id,
      medicine_type = s.medicine_type,
      prescription_class = m.prescription_class,
      packaging = nullif(trim(s.packaging), ''),
      public_visibility = not s.source_is_discontinued
        and nullif(trim(s.source_flags), '') is null,
      status = case
        when s.source_is_discontinued then 'inactive'
        when nullif(trim(s.source_flags), '') is not null then 'pending'
        else 'approved'
      end,
      reviewed_at = case
        when not s.source_is_discontinued
          and nullif(trim(s.source_flags), '') is null then now()
        else null
      end,
      review_note = case
        when s.source_is_discontinued then 'Source marks this product discontinued; hidden from public search.'
        when nullif(trim(s.source_flags), '') is not null then 'Needs data review: ' || s.source_flags
        else 'Catalog identity approved for discovery. Schedule H/H1/NRx classification was not supplied and remains unverified.'
      end,
      updated_at = now()
  from public.medicine_catalog_import_20261029 s
  left join public.compositions c on c.normalized_name = lower(trim(s.composition))
  left join public.manufacturers mf on mf.normalized_name = lower(trim(s.manufacturer))
  left join public.categories cat on cat.slug = s.category_slug
  where m.normalized_product_name = lower(trim(s.product_name))
    and m.strength = s.strength
    and m.manufacturer_id = mf.id
    and (m.catalog_source_key is null or m.catalog_source_key = s.source_key);
  get diagnostics v_changed = row_count;

  insert into public.medicines (
    product_name, brand_name, composition_id, strength, manufacturer_id,
    category_id, medicine_type, prescription_class, packaging,
    public_visibility, status, reviewed_at, review_note,
    catalog_source_key, catalog_source_flags, regulatory_schedule
  )
  select trim(s.product_name), nullif(trim(s.brand_name), ''), c.id,
    trim(s.strength), mf.id, cat.id, s.medicine_type, 'unknown',
    nullif(trim(s.packaging), ''),
    not s.source_is_discontinued and nullif(trim(s.source_flags), '') is null,
    case
      when s.source_is_discontinued then 'inactive'
      when nullif(trim(s.source_flags), '') is not null then 'pending'
      else 'approved'
    end,
    case when not s.source_is_discontinued and nullif(trim(s.source_flags), '') is null then now() else null end,
    case
      when s.source_is_discontinued then 'Source marks this product discontinued; hidden from public search.'
      when nullif(trim(s.source_flags), '') is not null then 'Needs data review: ' || s.source_flags
      else 'Catalog identity approved for discovery. Schedule H/H1/NRx classification was not supplied and remains unverified.'
    end,
    s.source_key, nullif(trim(s.source_flags), ''), '{}'
  from public.medicine_catalog_import_20261029 s
  left join public.compositions c on c.normalized_name = lower(trim(s.composition))
  left join public.manufacturers mf on mf.normalized_name = lower(trim(s.manufacturer))
  left join public.categories cat on cat.slug = s.category_slug
  where not exists (
    select 1 from public.medicines m
    where m.catalog_source_key = s.source_key
       or (m.normalized_product_name = lower(trim(s.product_name))
           and m.strength = s.strength and m.manufacturer_id = mf.id)
  )
  on conflict (catalog_source_key) where catalog_source_key is not null do nothing;
  get diagnostics v_count = row_count;

  return v_changed + v_count;
end;
$$;

revoke all on function public.import_indian_medicine_catalog_20261029() from public, anon, authenticated;
grant execute on function public.import_indian_medicine_catalog_20261029() to service_role;
