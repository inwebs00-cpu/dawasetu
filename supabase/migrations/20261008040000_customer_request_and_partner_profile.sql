-- Customer request history exposes a matched partner only after that partner
-- has replied that the medicine is available.
create or replace function public.list_my_medicine_requests()
returns table (
  request_id uuid,
  medicine_id uuid,
  requested_medicine_name text,
  composition_text text,
  strength text,
  quantity integer,
  approximate_area text,
  contact_preference text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  business_id uuid,
  business_name text,
  business_phone text,
  business_whatsapp text,
  business_address text,
  business_latitude numeric,
  business_longitude numeric,
  response_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select mr.id, mr.medicine_id, mr.requested_medicine_name, mr.composition_text,
    mr.strength, mr.quantity, a.name, mr.contact_preference,
    case when mr.expires_at <= pg_catalog.now() and mr.status in ('open', 'partially_fulfilled')
      then 'expired' else mr.status end,
    mr.created_at, mr.expires_at, b.id, b.business_name,
    case when rr.response = 'available' then b.phone_e164 end,
    case when rr.response = 'available' then b.whatsapp_e164 end,
    case when rr.response = 'available' then pg_catalog.concat_ws(', ', b.address_line1, b.address_line2, b.postal_code) end,
    case when rr.response = 'available' then b.latitude end,
    case when rr.response = 'available' then b.longitude end,
    case when rr.response = 'available' then rr.message end
  from public.medicine_requests mr
  left join public.areas a on a.id = mr.customer_area_id
  left join public.medicine_request_responses rr on rr.request_id = mr.id and rr.response = 'available'
  left join public.businesses b on b.id = rr.business_id and b.status = 'approved'
    and b.public_availability_enabled
    and exists (select 1 from public.business_types bt where bt.id = b.business_type_id and not bt.is_distributor)
  where mr.customer_user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.status = 'active')
  order by mr.created_at desc
  limit 100;
$$;

revoke all on function public.list_my_medicine_requests() from public, anon;
grant execute on function public.list_my_medicine_requests() to authenticated;

-- Administrative expiry worker. Run this function from a trusted scheduled job.
create or replace function public.expire_stale_medicine_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.medicine_requests
    set status = 'expired', updated_at = pg_catalog.now()
  where status in ('open', 'partially_fulfilled') and expires_at <= pg_catalog.now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_stale_medicine_requests() from public, anon, authenticated;
grant execute on function public.expire_stale_medicine_requests() to service_role;
