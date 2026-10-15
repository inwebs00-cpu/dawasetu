alter table public.inquiries
  add column response_message text,
  add column responded_by uuid references public.users (id) on delete set null,
  add column responded_at timestamptz;

update public.inquiries
set response_message = 'Response recorded before in-app replies were enabled.',
    responded_at = updated_at
where status = 'responded';

alter table public.inquiries
  add constraint inquiries_response_message_length
    check (response_message is null or length(response_message) between 1 and 1000),
  add constraint inquiries_response_state
    check ((status = 'responded') = (response_message is not null and responded_at is not null));

revoke insert, update (status) on public.inquiries from authenticated;

create or replace function public.create_partner_inquiry(
  p_business_id uuid,
  p_medicine_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inquiry_id uuid;
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
begin
  if v_user_id is null then raise exception 'Sign in required'; end if;
  if not exists (
    select 1 from public.users u
    where u.id = v_user_id and u.status = 'active' and u.account_type = 'customer'
  ) then raise exception 'Customer account required'; end if;
  if pg_catalog.length(v_message) not between 1 and 1000 then
    raise exception 'Message must be between 1 and 1000 characters';
  end if;
  if not exists (
    select 1 from public.businesses b
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where b.id = p_business_id and b.status = 'approved'
      and b.public_availability_enabled
      and b.owner_user_id <> v_user_id
      and not exists (
        select 1 from public.business_team_members tm
        where tm.business_id = b.id and tm.user_id = v_user_id and tm.status = 'active'
      )
  ) then raise exception 'Partner is not accepting inquiries'; end if;
  if p_medicine_id is not null and not exists (
    select 1
    from public.inventory i
    join public.inventory_visibility iv on iv.inventory_id = i.id and iv.public_visible
    join public.medicines m on m.id = i.medicine_id and m.status = 'approved' and m.public_visibility
    where i.business_id = p_business_id and i.medicine_id = p_medicine_id
      and i.status in ('available', 'low_stock')
  ) then raise exception 'Choose a medicine listed by this partner'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if (select count(*) from public.inquiries q
      where q.customer_user_id = v_user_id
        and q.created_at > pg_catalog.now() - interval '1 hour') >= 5 then
    raise exception 'Too many inquiries. Try again later.';
  end if;

  insert into public.inquiries(customer_user_id, business_id, medicine_id, message, contact_preference)
  values (v_user_id, p_business_id, p_medicine_id, v_message, 'in_app')
  returning id into v_inquiry_id;
  return v_inquiry_id;
end;
$$;

create or replace function public.respond_to_partner_inquiry(
  p_business_id uuid,
  p_inquiry_id uuid,
  p_response_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_business_name text;
  v_message text := pg_catalog.btrim(coalesce(p_response_message, ''));
begin
  if v_user_id is null then raise exception 'Sign in required'; end if;
  if not public.has_business_permission(p_business_id, 'requests.respond') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(v_message) not between 1 and 1000 then
    raise exception 'Response must be between 1 and 1000 characters';
  end if;

  select q.customer_user_id, b.business_name
  into v_customer_id, v_business_name
  from public.inquiries q
  join public.businesses b on b.id = q.business_id
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  where q.id = p_inquiry_id and q.business_id = p_business_id
    and q.status = 'open' and b.status = 'approved' and b.public_availability_enabled;
  if not found then raise exception 'Inquiry is no longer open'; end if;

  update public.inquiries
  set status = 'responded', response_message = v_message,
      responded_by = v_user_id, responded_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_inquiry_id and business_id = p_business_id and status = 'open';
  if not found then raise exception 'Inquiry was already answered'; end if;

  if v_customer_id is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (
      v_customer_id,
      p_business_id,
      'business_inquiry_response',
      'A pharmacy replied to your inquiry',
      v_business_name || ' sent a reply. Open your DawaSetu account to read it.',
      pg_catalog.jsonb_build_object('inquiry_id', p_inquiry_id)
    );
  end if;
  return true;
end;
$$;

revoke all on function public.create_partner_inquiry(uuid, uuid, text) from public, anon;
revoke all on function public.respond_to_partner_inquiry(uuid, uuid, text) from public, anon;
grant execute on function public.create_partner_inquiry(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_partner_inquiry(uuid, uuid, text) to authenticated;
