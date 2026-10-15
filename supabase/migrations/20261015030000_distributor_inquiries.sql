create table public.distributor_inquiries (
  id uuid primary key default gen_random_uuid(),
  partner_business_id uuid not null references public.businesses (id) on delete restrict,
  distributor_business_id uuid not null references public.businesses (id) on delete restrict,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  created_by uuid not null references public.users (id) on delete restrict,
  requested_quantity integer not null check (requested_quantity between 1 and 1000000),
  message text check (message is null or length(trim(message)) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'responded', 'unavailable', 'closed')),
  response_message text check (response_message is null or length(trim(response_message)) <= 1000),
  responded_by uuid references public.users (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (partner_business_id <> distributor_business_id),
  check ((status = 'open') = (responded_at is null))
);

create index distributor_inquiries_distributor_status_created_idx
  on public.distributor_inquiries (distributor_business_id, status, created_at desc);
create index distributor_inquiries_partner_created_idx
  on public.distributor_inquiries (partner_business_id, created_at desc);

alter table public.distributor_inquiries enable row level security;
revoke all on public.distributor_inquiries from public, anon, authenticated;

create trigger set_updated_at_distributor_inquiries
before update on public.distributor_inquiries
for each row execute function public.set_updated_at();

create or replace function public.create_partner_distributor_inquiry(
  p_partner_business_id uuid,
  p_distributor_business_id uuid,
  p_medicine_id uuid,
  p_requested_quantity integer,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_inquiry_id uuid;
  v_distributor_owner uuid;
begin
  if v_actor is null or not public.has_business_permission(p_partner_business_id, 'distributors.view') then
    raise exception 'Permission denied';
  end if;
  if p_requested_quantity is null or p_requested_quantity not between 1 and 1000000
    or length(coalesce(p_message, '')) > 1000 then
    raise exception 'Invalid inquiry details';
  end if;
  if not exists (
    select 1 from public.businesses p
    join public.business_types pt on pt.id = p.business_type_id and not pt.is_distributor
    where p.id = p_partner_business_id and p.status = 'approved'
  ) or not exists (
    select 1 from public.businesses d
    join public.business_types dt on dt.id = d.business_type_id and dt.is_distributor
    where d.id = p_distributor_business_id and d.status = 'approved'
  ) then
    raise exception 'Approved partner and distributor are required';
  end if;
  if not exists (
    select 1 from public.distributor_partner_access a
    where a.partner_business_id = p_partner_business_id
      and a.distributor_business_id = p_distributor_business_id
      and a.status = 'approved'
  ) then
    raise exception 'Distributor access is not approved';
  end if;
  if not exists (
    select 1 from public.inventory i
    join public.medicines m on m.id = i.medicine_id and m.status = 'approved'
    where i.business_id = p_distributor_business_id
      and i.medicine_id = p_medicine_id
      and i.status in ('available', 'low_stock')
  ) then
    raise exception 'Medicine is not currently reported in stock';
  end if;
  if (
    select count(*) from public.distributor_inquiries di
    where di.partner_business_id = p_partner_business_id
      and di.distributor_business_id = p_distributor_business_id
      and di.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Daily distributor inquiry limit reached';
  end if;

  insert into public.distributor_inquiries (
    partner_business_id, distributor_business_id, medicine_id,
    created_by, requested_quantity, message
  ) values (
    p_partner_business_id, p_distributor_business_id, p_medicine_id,
    v_actor, p_requested_quantity, nullif(btrim(p_message), '')
  ) returning id into v_inquiry_id;

  select d.owner_user_id into v_distributor_owner
  from public.businesses d where d.id = p_distributor_business_id;
  if v_distributor_owner is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (
      v_distributor_owner, p_distributor_business_id, 'distributor_inquiry',
      'New partner stock inquiry',
      'A verified partner asked about reported medicine availability.',
      jsonb_build_object('inquiry_id', v_inquiry_id, 'partner_business_id', p_partner_business_id)
    );
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (
    v_actor, 'distributor_inquiry.created', 'distributors', 'distributor_inquiries', v_inquiry_id,
    jsonb_build_object(
      'partner_business_id', p_partner_business_id,
      'distributor_business_id', p_distributor_business_id,
      'medicine_id', p_medicine_id,
      'requested_quantity', p_requested_quantity
    )
  );
  return v_inquiry_id;
end;
$$;

create or replace function public.list_my_distributor_inquiries(
  p_distributor_business_id uuid,
  p_status text default null
)
returns table (
  inquiry_id uuid,
  partner_business_id uuid,
  partner_name text,
  partner_type text,
  partner_area text,
  medicine_id uuid,
  product_name text,
  brand_name text,
  composition text,
  strength text,
  requested_quantity integer,
  message text,
  status text,
  response_message text,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(p_distributor_business_id, 'distributors.access.manage') then
    raise exception 'Permission denied';
  end if;
  if p_status is not null and p_status not in ('open', 'responded', 'unavailable', 'closed') then
    raise exception 'Invalid inquiry status';
  end if;
  return query
  select di.id, p.id, p.business_name, pt.name, a.name,
    m.id, m.product_name, m.brand_name, c.name, m.strength,
    di.requested_quantity, di.message, di.status, di.response_message,
    di.created_at, di.responded_at
  from public.distributor_inquiries di
  join public.businesses p on p.id = di.partner_business_id
  join public.business_types pt on pt.id = p.business_type_id
  join public.medicines m on m.id = di.medicine_id
  left join public.compositions c on c.id = m.composition_id
  left join public.areas a on a.id = p.area_id
  where di.distributor_business_id = p_distributor_business_id
    and (p_status is null or di.status = p_status)
  order by case di.status when 'open' then 0 else 1 end, di.created_at desc
  limit 100;
end;
$$;

create or replace function public.list_my_partner_distributor_inquiries(
  p_partner_business_id uuid
)
returns table (
  inquiry_id uuid,
  distributor_business_id uuid,
  distributor_name text,
  medicine_id uuid,
  product_name text,
  strength text,
  requested_quantity integer,
  status text,
  response_message text,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_business_permission(p_partner_business_id, 'distributors.view') then
    raise exception 'Permission denied';
  end if;
  return query
  select di.id, d.id, d.business_name, m.id, m.product_name, m.strength,
    di.requested_quantity, di.status, di.response_message, di.created_at, di.responded_at
  from public.distributor_inquiries di
  join public.businesses d on d.id = di.distributor_business_id
  join public.medicines m on m.id = di.medicine_id
  where di.partner_business_id = p_partner_business_id
  order by di.created_at desc
  limit 50;
end;
$$;

create or replace function public.respond_to_distributor_inquiry(
  p_distributor_business_id uuid,
  p_inquiry_id uuid,
  p_decision text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inquiry public.distributor_inquiries%rowtype;
  v_partner_owner uuid;
begin
  if not public.has_business_permission(p_distributor_business_id, 'distributors.access.manage') then
    raise exception 'Permission denied';
  end if;
  if p_decision is null or p_decision not in ('responded', 'unavailable', 'closed')
    or length(coalesce(p_message, '')) > 1000
    or (p_decision in ('responded', 'unavailable') and length(btrim(coalesce(p_message, ''))) < 2) then
    raise exception 'Invalid inquiry response';
  end if;
  select * into v_inquiry from public.distributor_inquiries
  where id = p_inquiry_id and distributor_business_id = p_distributor_business_id
  for update;
  if not found or v_inquiry.status <> 'open' then
    raise exception 'Inquiry is no longer open';
  end if;
  update public.distributor_inquiries set
    status = p_decision,
    response_message = nullif(btrim(p_message), ''),
    responded_by = auth.uid(), responded_at = now(), updated_at = now()
  where id = p_inquiry_id;
  select p.owner_user_id into v_partner_owner
  from public.businesses p where p.id = v_inquiry.partner_business_id;
  if v_partner_owner is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (
      v_partner_owner, v_inquiry.partner_business_id, 'distributor_inquiry_response',
      'Distributor replied to your inquiry',
      'A distributor updated your B2B stock inquiry.',
      jsonb_build_object('inquiry_id', p_inquiry_id, 'status', p_decision)
    );
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (
    auth.uid(), 'distributor_inquiry.' || p_decision, 'distributors',
    'distributor_inquiries', p_inquiry_id,
    jsonb_build_object('status', p_decision, 'response_message', nullif(btrim(p_message), ''))
  );
  return p_inquiry_id;
end;
$$;

revoke all on function public.create_partner_distributor_inquiry(uuid, uuid, uuid, integer, text) from public, anon;
revoke all on function public.list_my_distributor_inquiries(uuid, text) from public, anon;
revoke all on function public.list_my_partner_distributor_inquiries(uuid) from public, anon;
revoke all on function public.respond_to_distributor_inquiry(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_partner_distributor_inquiry(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.list_my_distributor_inquiries(uuid, text) to authenticated;
grant execute on function public.list_my_partner_distributor_inquiries(uuid) to authenticated;
grant execute on function public.respond_to_distributor_inquiry(uuid, uuid, text, text) to authenticated;
