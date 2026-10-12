alter table public.payments add column invoice_number text unique;

create or replace function public.assign_payment_invoice_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.invoice_number is null then
    new.invoice_number := 'DS-' || to_char(coalesce(new.paid_at, now()), 'YYYYMMDD') || '-'
      || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create trigger assign_payment_invoice_number_before_paid
before update of status on public.payments
for each row execute function public.assign_payment_invoice_number();

create or replace function public.get_my_payment_invoice(p_payment_id uuid)
returns table (
  payment_id uuid,
  invoice_number text,
  business_id uuid,
  business_name text,
  business_email text,
  business_phone text,
  business_address text,
  registration_number text,
  plan_name text,
  amount_inr numeric,
  currency text,
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select p.id, p.invoice_number, b.id, b.business_name, b.email, b.phone_e164,
    concat_ws(', ', b.address_line1, b.address_line2, a.name, d.name, s.name, b.postal_code),
    b.registration_number, sp.name, p.amount_inr, p.currency, p.provider,
    p.provider_payment_id, p.paid_at, p.created_at
  from public.payments p
  join public.businesses b on b.id = p.business_id
  left join public.areas a on a.id = b.area_id
  left join public.districts d on d.id = a.district_id
  left join public.states s on s.id = d.state_id
  left join public.subscriptions sub on sub.id = p.subscription_id
  left join public.subscription_plans sp on sp.id = sub.plan_id
  where p.id = p_payment_id and p.status = 'paid'
    and (b.owner_user_id = auth.uid()
      or public.has_business_permission(b.id, 'payments.view')
      or public.has_platform_permission('payments.view'));
end;
$$;

revoke all on function public.get_my_payment_invoice(uuid) from public, anon;
grant execute on function public.get_my_payment_invoice(uuid) to authenticated;
