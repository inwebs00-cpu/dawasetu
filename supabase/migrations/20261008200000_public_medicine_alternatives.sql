create or replace function public.list_public_same_composition_medicines(
  p_medicine_id uuid
)
returns table (
  reference_medicine_id uuid,
  reference_product_name text,
  reference_strength text,
  reference_composition text,
  reference_prescription_class text,
  alternative_medicine_id uuid,
  alternative_product_name text,
  alternative_brand_name text,
  alternative_strength text,
  alternative_composition text,
  alternative_manufacturer text
)
language sql
stable
security definer
set search_path = ''
as $$
  select source.id, source.product_name, source.strength, composition.name,
    source.prescription_class, related.id, related.product_name, related.brand_name,
    related.strength, composition.name, manufacturer.name
  from public.medicines source
  join public.compositions composition on composition.id = source.composition_id
    and composition.status = 'approved'
  left join public.medicines related on related.composition_id = source.composition_id
    and related.id <> source.id and related.status = 'approved'
    and related.public_visibility
  left join public.manufacturers manufacturer on manufacturer.id = related.manufacturer_id
    and manufacturer.status = 'approved'
  where source.id = p_medicine_id and source.status = 'approved'
    and source.public_visibility
  order by related.strength, related.product_name
  limit 11;
$$;

revoke all on function public.list_public_same_composition_medicines(uuid) from public;
grant execute on function public.list_public_same_composition_medicines(uuid) to anon, authenticated;
