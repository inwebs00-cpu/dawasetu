alter table public.payments
  add column refunded_amount_inr numeric(12, 2) not null default 0
    check (refunded_amount_inr >= 0 and refunded_amount_inr <= amount_inr);

create table public.payment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  requested_by uuid not null references public.users (id) on delete restrict,
  amount_inr numeric(12, 2) not null check (amount_inr > 0),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  status text not null default 'requested'
    check (status in ('requested', 'pending', 'processed', 'failed')),
  provider_refund_id text unique check (provider_refund_id is null or provider_refund_id ~ '^rfnd_[A-Za-z0-9]+$'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_refund_requests_payment_created_idx
  on public.payment_refund_requests (payment_id, created_at desc);
create unique index payment_refund_requests_one_inflight_idx
  on public.payment_refund_requests (payment_id)
  where status in ('requested', 'pending');

alter table public.payment_refund_requests enable row level security;
revoke all on public.payment_refund_requests from public, anon, authenticated;
grant select, insert, update on public.payment_refund_requests to service_role;

create or replace function public.admin_list_refundable_payments()
returns table (
  payment_id uuid,
  business_name text,
  plan_name text,
  provider_payment_id text,
  amount_inr numeric,
  refunded_amount_inr numeric,
  refundable_balance_inr numeric,
  currency text,
  paid_at timestamptz,
  pending_refund_id uuid,
  pending_refund_status text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select p.id, b.business_name, sp.name, p.provider_payment_id,
    p.amount_inr, p.refunded_amount_inr,
    greatest(p.amount_inr - p.refunded_amount_inr - coalesce(active_refund.amount_inr, 0), 0),
    p.currency, p.paid_at, active_refund.id, active_refund.status
  from public.payments p
  join public.businesses b on b.id = p.business_id
  left join public.subscriptions sub on sub.id = p.subscription_id
  left join public.subscription_plans sp on sp.id = sub.plan_id
  left join lateral (
    select r.id, r.status, r.amount_inr
    from public.payment_refund_requests r
    where r.payment_id = p.id and r.status in ('requested', 'pending')
    order by r.created_at desc
    limit 1
  ) active_refund on true
  where p.provider = 'razorpay'
    and p.provider_payment_id is not null
    and p.status in ('paid', 'partially_refunded')
  order by p.paid_at desc nulls last, p.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_list_payment_refund_requests()
returns table (
  refund_request_id uuid,
  payment_id uuid,
  business_name text,
  plan_name text,
  provider_payment_id text,
  provider_refund_id text,
  amount_inr numeric,
  reason text,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select r.id, p.id, b.business_name, sp.name, p.provider_payment_id,
    r.provider_refund_id, r.amount_inr, r.reason, r.status, r.created_at, r.processed_at
  from public.payment_refund_requests r
  join public.payments p on p.id = r.payment_id
  join public.businesses b on b.id = p.business_id
  left join public.subscriptions sub on sub.id = p.subscription_id
  left join public.subscription_plans sp on sp.id = sub.plan_id
  order by r.created_at desc
  limit 100;
end;
$$;

drop function if exists public.admin_reserve_payment_refund(uuid, integer, text);

create function public.admin_reserve_payment_refund(
  p_payment_id uuid,
  p_amount_paise integer,
  p_reason text
)
returns table (refund_request_id uuid, provider_payment_id text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_pending numeric(12, 2);
  v_amount numeric(12, 2);
  v_request_id uuid;
begin
  if v_actor is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  if p_payment_id is null or p_amount_paise is null or p_amount_paise <= 0
    or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Invalid refund details';
  end if;
  v_amount := round(p_amount_paise::numeric / 100, 2);
  select p.* into v_payment
  from public.payments p where p.id = p_payment_id for update;
  if not found or v_payment.provider <> 'razorpay'
    or v_payment.provider_payment_id is null
    or v_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'Payment is not refundable';
  end if;
  select coalesce(sum(r.amount_inr), 0) into v_pending
  from public.payment_refund_requests r
  where r.payment_id = p_payment_id and r.status in ('requested', 'pending');
  if v_amount > v_payment.amount_inr - v_payment.refunded_amount_inr - v_pending then
    raise exception 'Refund exceeds the remaining refundable amount';
  end if;
  insert into public.payment_refund_requests(payment_id, requested_by, amount_inr, reason)
  values (p_payment_id, v_actor, v_amount, btrim(p_reason))
  returning id into v_request_id;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, new_value
  ) values (
    v_actor, 'payment.refund_requested', 'payments', 'payment_refund_requests', v_request_id,
    jsonb_build_object('payment_id', p_payment_id, 'amount_inr', v_amount, 'reason', btrim(p_reason))
  );
  return query select v_request_id, v_payment.provider_payment_id;
end;
$$;

create or replace function public.service_update_payment_refund_request(
  p_refund_request_id uuid,
  p_status text,
  p_provider_refund_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_refund public.payment_refund_requests%rowtype;
begin
  if p_status not in ('pending', 'failed')
    or p_provider_refund_id is not null and p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]+$' then
    raise exception 'Invalid refund provider state';
  end if;
  select r.* into v_refund from public.payment_refund_requests r
  where r.id = p_refund_request_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if v_refund.status <> 'requested' then
    return v_refund.status = p_status and v_refund.provider_refund_id = p_provider_refund_id;
  end if;
  if p_status = 'pending' and p_provider_refund_id is null then
    raise exception 'Provider refund identifier required';
  end if;
  update public.payment_refund_requests r set
    status = p_status,
    provider_refund_id = p_provider_refund_id,
    updated_at = now()
  where r.id = p_refund_request_id;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value, new_value
  ) values (
    null, 'payment.refund_' || p_status, 'payments', 'payment_refund_requests', p_refund_request_id,
    jsonb_build_object('status', 'requested'),
    jsonb_build_object('status', p_status, 'provider_refund_id', p_provider_refund_id)
  );
  return true;
end;
$$;

create or replace function public.service_process_payment_refund_event(
  p_event_id text,
  p_refund_request_id uuid,
  p_provider_payment_id text,
  p_provider_refund_id text,
  p_amount_paise integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_refund public.payment_refund_requests%rowtype;
  v_payment public.payments%rowtype;
  v_owner_id uuid;
  v_amount numeric(12, 2);
begin
  if p_event_id is null or length(p_event_id) not between 1 and 255
    or p_refund_request_id is null
    or p_provider_payment_id !~ '^pay_[A-Za-z0-9]+$'
    or p_provider_refund_id !~ '^rfnd_[A-Za-z0-9]+$'
    or p_amount_paise is null or p_amount_paise <= 0 or p_currency <> 'INR' then
    raise exception 'Invalid refund event';
  end if;
  insert into public.payment_webhook_events(provider, event_id, event_type)
  values ('razorpay', p_event_id, 'refund.processed')
  on conflict do nothing;
  if not found then return 'duplicate'; end if;
  select r.* into v_refund from public.payment_refund_requests r
  where r.id = p_refund_request_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  v_amount := round(p_amount_paise::numeric / 100, 2);
  if v_refund.amount_inr <> v_amount then raise exception 'Refund amount mismatch'; end if;
  if v_refund.provider_refund_id is not null
    and v_refund.provider_refund_id <> p_provider_refund_id then
    raise exception 'Provider refund identifier mismatch';
  end if;
  if v_refund.status not in ('requested', 'pending') then
    if v_refund.status <> 'processed' then
      raise exception 'Refund request is not processable';
    end if;
  end if;

  select p.* into v_payment from public.payments p
  where p.id = v_refund.payment_id
    and p.provider = 'razorpay'
    and p.provider_payment_id = p_provider_payment_id
  for update;
  if not found or v_payment.refunded_amount_inr + v_amount > v_payment.amount_inr then
    raise exception 'Refund total exceeds the captured payment';
  end if;
  if v_refund.status = 'processed' then return 'already_processed'; end if;
  update public.payment_refund_requests r set
    status = 'processed', provider_refund_id = p_provider_refund_id,
    processed_at = now(), updated_at = now()
  where r.id = p_refund_request_id;
  update public.payments p set
    refunded_amount_inr = p.refunded_amount_inr + v_amount,
    status = case when p.refunded_amount_inr + v_amount = p.amount_inr
      then 'refunded' else 'partially_refunded' end,
    updated_at = now()
  where p.id = v_payment.id;
  select b.owner_user_id into v_owner_id from public.businesses b where b.id = v_payment.business_id;
  if v_owner_id is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (v_owner_id, v_payment.business_id, 'subscription_refund', 'Subscription refund processed',
      'A subscription refund has been processed.',
      jsonb_build_object('payment_id', v_payment.id, 'refund_request_id', p_refund_request_id, 'amount_inr', v_amount));
  end if;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, new_value
  ) values (
    null, 'payment.refund_processed', 'payments', 'payment_refund_requests', p_refund_request_id,
    jsonb_build_object('payment_id', v_payment.id, 'provider_refund_id', p_provider_refund_id, 'amount_inr', v_amount)
  );
  return 'processed';
end;
$$;

create or replace function public.admin_get_analytics_summary(p_days integer default 30)
returns table (
  total_users bigint,
  new_users bigint,
  approved_partners bigint,
  new_approved_partners bigint,
  medicine_searches bigint,
  profile_views bigint,
  medicine_requests bigint,
  paid_revenue_inr numeric
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('reports.view') then
    raise exception 'Permission denied';
  end if;
  if p_days not between 1 and 365 then raise exception 'Invalid reporting range'; end if;
  return query
  select
    (select count(*) from public.users),
    (select count(*) from public.users u where u.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.businesses b where b.status = 'approved'),
    (select count(*) from public.businesses b where b.status = 'approved'
      and b.created_at >= now() - make_interval(days => p_days)),
    (select count(*) from public.medicine_search_events e
      where e.searched_on >= current_date - p_days + 1),
    (select count(*) from public.business_profile_view_events e
      where e.viewed_on >= current_date - p_days + 1),
    (select count(*) from public.medicine_requests r
      where r.created_at >= now() - make_interval(days => p_days)),
    (select coalesce(sum(p.amount_inr - p.refunded_amount_inr), 0)::numeric(12,2)
      from public.payments p
      where p.status in ('paid', 'partially_refunded', 'refunded')
        and p.paid_at >= now() - make_interval(days => p_days));
end;
$$;

revoke all on function public.admin_list_refundable_payments() from public, anon;
revoke all on function public.admin_list_payment_refund_requests() from public, anon;
revoke all on function public.admin_reserve_payment_refund(uuid, integer, text) from public, anon;
revoke all on function public.service_update_payment_refund_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.service_process_payment_refund_event(text, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_list_refundable_payments() to authenticated;
grant execute on function public.admin_list_payment_refund_requests() to authenticated;
grant execute on function public.admin_reserve_payment_refund(uuid, integer, text) to authenticated;
grant execute on function public.service_update_payment_refund_request(uuid, text, text) to service_role;
grant execute on function public.service_process_payment_refund_event(text, uuid, text, text, integer, text) to service_role;
