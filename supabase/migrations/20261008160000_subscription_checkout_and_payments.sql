create unique index payments_provider_order_unique
  on public.payments (provider, provider_order_id)
  where provider_order_id is not null;

create table public.payment_webhook_events (
  provider text not null check (provider in ('razorpay', 'cashfree', 'manual')),
  event_id text not null check (length(event_id) between 1 and 255),
  event_type text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from anon, authenticated;

create or replace function public.get_my_subscription_purchase_quote(
  p_business_id uuid,
  p_plan_id uuid,
  p_billing_interval text
)
returns table (
  plan_id uuid,
  plan_name text,
  business_name text,
  amount_paise integer,
  currency text,
  billing_interval text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_price numeric;
begin
  if auth.uid() is null
    or not (public.has_business_permission(p_business_id, 'payments.manage')
      or public.has_platform_permission('payments.manage')) then
    raise exception 'Permission denied';
  end if;
  if p_billing_interval not in ('monthly', 'yearly') then
    raise exception 'Invalid billing interval';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'approved'
  ) then
    raise exception 'Approved business not found';
  end if;
  select case when p_billing_interval = 'monthly' then sp.monthly_price_inr else sp.yearly_price_inr end
  into v_price
  from public.subscription_plans sp
  where sp.id = p_plan_id and sp.is_active;
  if not found then raise exception 'Active plan not found'; end if;
  if v_price <= 0 or v_price * 100 > 2147483647 then
    raise exception 'This plan cannot be purchased through online checkout';
  end if;
  return query
  select sp.id, sp.name, b.business_name, round(v_price * 100)::integer, 'INR'::text, p_billing_interval
  from public.subscription_plans sp
  join public.businesses b on b.id = p_business_id
  where sp.id = p_plan_id;
end;
$$;

create or replace function public.create_my_subscription_payment_order(
  p_business_id uuid,
  p_plan_id uuid,
  p_billing_interval text,
  p_razorpay_order_id text,
  p_amount_paise integer
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_quote record;
  v_subscription_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_razorpay_order_id !~ '^order_[A-Za-z0-9]+$' then raise exception 'Invalid payment order'; end if;
  select * into v_quote from public.get_my_subscription_purchase_quote(p_business_id, p_plan_id, p_billing_interval);
  if not found or v_quote.amount_paise <> p_amount_paise then
    raise exception 'Payment amount does not match the selected plan';
  end if;
  if (select count(*) from public.payments p
      where p.business_id = p_business_id and p.provider = 'razorpay'
        and p.status = 'pending' and p.created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many pending payment attempts';
  end if;
  insert into public.subscriptions(business_id, plan_id, status, billing_interval)
  values (p_business_id, p_plan_id, 'pending', p_billing_interval)
  returning id into v_subscription_id;
  insert into public.payments(
    business_id, subscription_id, provider, provider_order_id, amount_inr, currency, status
  ) values (
    p_business_id, v_subscription_id, 'razorpay', p_razorpay_order_id,
    v_quote.amount_paise::numeric / 100, 'INR', 'pending'
  );
  return v_subscription_id;
end;
$$;

create or replace function public.get_my_razorpay_order(
  p_razorpay_order_id text
)
returns table (
  payment_id uuid,
  business_id uuid,
  subscription_id uuid,
  amount_paise integer,
  currency text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select p.id, p.business_id, p.subscription_id, round(p.amount_inr * 100)::integer, p.currency
  from public.payments p
  where p.provider = 'razorpay'
    and p.provider_order_id = p_razorpay_order_id
    and exists (
      select 1 from public.businesses b
      where b.id = p.business_id and (
        b.owner_user_id = auth.uid()
        or public.has_business_permission(b.id, 'payments.manage')
        or public.has_platform_permission('payments.manage')
      )
    );
end;
$$;

create or replace function public.service_process_razorpay_payment_event(
  p_event_id text,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise integer,
  p_currency text,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_payment public.payments%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_owner_id uuid;
  v_expected_paise integer;
begin
  if p_event_type not in ('payment.captured', 'payment.failed') then
    raise exception 'Unsupported payment event';
  end if;
  if p_event_id is null or length(p_event_id) not between 1 and 255 then
    raise exception 'Invalid event id';
  end if;
  if p_razorpay_order_id !~ '^order_[A-Za-z0-9]+$'
    or p_razorpay_payment_id !~ '^pay_[A-Za-z0-9]+$' then
    raise exception 'Invalid Razorpay payment identifiers';
  end if;
  insert into public.payment_webhook_events(provider, event_id, event_type)
  values ('razorpay', p_event_id, p_event_type)
  on conflict do nothing;
  if not found then return 'duplicate'; end if;

  select p.* into v_payment
  from public.payments p
  where p.provider = 'razorpay' and p.provider_order_id = p_razorpay_order_id
  for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_payment.subscription_id is null then raise exception 'Subscription record missing'; end if;
  select * into v_subscription from public.subscriptions s
  where s.id = v_payment.subscription_id for update;
  if not found then raise exception 'Subscription record missing'; end if;
  select b.owner_user_id into v_owner_id from public.businesses b where b.id = v_payment.business_id;
  v_expected_paise := round(v_payment.amount_inr * 100)::integer;

  if p_event_type = 'payment.failed' then
    if v_payment.status = 'paid' then return 'ignored'; end if;
    update public.payments set status = 'failed', updated_at = now()
    where id = v_payment.id and status <> 'paid';
    update public.subscriptions set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
    where id = v_subscription.id and status = 'pending';
    return 'failed';
  end if;

  if p_currency <> 'INR' or p_amount_paise <> v_expected_paise then
    raise exception 'Captured amount or currency mismatch';
  end if;
  if v_payment.status = 'paid' then
    if v_payment.provider_payment_id = p_razorpay_payment_id then return 'already_paid'; end if;
    raise exception 'Order is already settled by another payment';
  end if;
  update public.payments set status = 'paid', provider_payment_id = p_razorpay_payment_id,
    paid_at = now(), updated_at = now()
  where id = v_payment.id;

  update public.subscriptions set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where business_id = v_payment.business_id and id <> v_subscription.id
    and status in ('active', 'trialing');
  update public.subscriptions set status = 'active', current_period_start = now(),
    current_period_end = case when billing_interval = 'yearly' then now() + interval '1 year' else now() + interval '1 month' end,
    trial_ends_at = null, cancelled_at = null, updated_at = now()
  where id = v_subscription.id;

  if v_owner_id is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (v_owner_id, v_payment.business_id, 'subscription_payment', 'Subscription active',
      'Your DawaSetu subscription payment was confirmed.',
      jsonb_build_object('subscription_id', v_subscription.id, 'payment_id', v_payment.id));
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value, metadata)
  values (null, 'payment.captured', 'payments', 'payments', v_payment.id,
    jsonb_build_object('status', 'paid', 'provider_payment_id', p_razorpay_payment_id),
    jsonb_build_object('subscription_id', v_subscription.id, 'amount_inr', v_payment.amount_inr, 'business_owner_id', v_owner_id));
  return 'paid';
end;
$$;

create or replace function public.start_my_subscription_trial(
  p_business_id uuid,
  p_plan_id uuid,
  p_billing_interval text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_trial_days integer;
  v_subscription_id uuid;
begin
  if auth.uid() is null or not (
    public.has_business_permission(p_business_id, 'payments.manage')
    or public.has_platform_permission('payments.manage')
  ) then raise exception 'Permission denied'; end if;
  if p_billing_interval not in ('monthly', 'yearly') then raise exception 'Invalid billing interval'; end if;
  if not exists (select 1 from public.businesses where id = p_business_id and status = 'approved') then
    raise exception 'Approved business not found';
  end if;
  select trial_days into v_trial_days from public.subscription_plans
  where id = p_plan_id and is_active;
  if not found or v_trial_days is null or v_trial_days < 1 then raise exception 'This plan has no trial'; end if;
  if exists (select 1 from public.subscriptions where business_id = p_business_id and trial_ends_at is not null) then
    raise exception 'This business has already used a subscription trial';
  end if;
  if (select count(*) from public.subscriptions s
      where s.business_id = p_business_id and s.created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many subscription attempts';
  end if;
  update public.subscriptions set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where business_id = p_business_id and status in ('active', 'trialing');
  insert into public.subscriptions(
    business_id, plan_id, status, billing_interval,
    current_period_start, current_period_end, trial_ends_at
  ) values (
    p_business_id, p_plan_id, 'trialing', p_billing_interval,
    now(), now() + make_interval(days => v_trial_days), now() + make_interval(days => v_trial_days)
  ) returning id into v_subscription_id;
  insert into public.notifications(user_id, business_id, event_type, title, body, payload)
  select b.owner_user_id, b.id, 'subscription_trial', 'Subscription trial started',
    'Your plan trial is active until ' || to_char(now() + make_interval(days => v_trial_days), 'DD Mon YYYY') || '.',
    jsonb_build_object('subscription_id', v_subscription_id, 'trial_days', v_trial_days)
  from public.businesses b where b.id = p_business_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (auth.uid(), 'subscription.trial_started', 'payments', 'subscriptions', v_subscription_id,
    jsonb_build_object('business_id', p_business_id, 'plan_id', p_plan_id, 'trial_days', v_trial_days));
  return v_subscription_id;
end;
$$;

create or replace function public.expire_stale_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
begin
  update public.subscriptions set status = 'expired', updated_at = now()
  where status in ('active', 'trialing') and current_period_end <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.list_my_subscription_history(p_business_id uuid)
returns table (
  subscription_id uuid,
  plan_name text,
  status text,
  billing_interval text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    public.has_business_permission(p_business_id, 'payments.view')
    or public.has_platform_permission('payments.view')
  ) then raise exception 'Permission denied'; end if;
  return query
  select s.id, sp.name, s.status, s.billing_interval, s.current_period_start,
    s.current_period_end, s.created_at
  from public.subscriptions s
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.business_id = p_business_id
  order by s.created_at desc
  limit 50;
end;
$$;

create or replace function public.list_my_payment_history(p_business_id uuid)
returns table (
  payment_id uuid,
  plan_name text,
  amount_inr numeric,
  currency text,
  status text,
  provider text,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    public.has_business_permission(p_business_id, 'payments.view')
    or public.has_platform_permission('payments.view')
  ) then raise exception 'Permission denied'; end if;
  return query
  select p.id, sp.name, p.amount_inr, p.currency, p.status, p.provider, p.paid_at, p.created_at
  from public.payments p
  left join public.subscriptions s on s.id = p.subscription_id
  left join public.subscription_plans sp on sp.id = s.plan_id
  where p.business_id = p_business_id
  order by p.created_at desc
  limit 50;
end;
$$;

revoke all on function public.get_my_subscription_purchase_quote(uuid, uuid, text) from public, anon;
revoke all on function public.create_my_subscription_payment_order(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.get_my_razorpay_order(text) from public, anon;
revoke all on function public.service_process_razorpay_payment_event(text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.start_my_subscription_trial(uuid, uuid, text) from public, anon;
revoke all on function public.expire_stale_subscriptions() from public, anon, authenticated;
revoke all on function public.list_my_subscription_history(uuid) from public, anon;
revoke all on function public.list_my_payment_history(uuid) from public, anon;
grant execute on function public.get_my_subscription_purchase_quote(uuid, uuid, text) to authenticated;
grant execute on function public.create_my_subscription_payment_order(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.get_my_razorpay_order(text) to authenticated;
grant execute on function public.service_process_razorpay_payment_event(text, text, text, integer, text, text) to service_role;
grant execute on function public.start_my_subscription_trial(uuid, uuid, text) to authenticated;
grant execute on function public.expire_stale_subscriptions() to service_role;
grant execute on function public.list_my_subscription_history(uuid) to authenticated;
grant execute on function public.list_my_payment_history(uuid) to authenticated;
