create table public.payment_gateway_state (
  id boolean primary key default true check (id),
  admin_managed boolean not null default false,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.payment_gateway_state (id, admin_managed)
values (true, false)
on conflict (id) do nothing;

create table public.payment_gateway_configurations (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'razorpay'),
  display_name text not null check (length(btrim(display_name)) between 2 and 80),
  key_id text not null check (length(key_id) between 12 and 128),
  encrypted_key_secret text not null check (length(encrypted_key_secret) between 32 and 1200),
  encrypted_webhook_secret text not null check (length(encrypted_webhook_secret) between 32 and 1200),
  mode text not null check (mode in ('test', 'live')),
  enabled boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (mode = 'test' and key_id like 'rzp_test_%')
    or (mode = 'live' and key_id like 'rzp_live_%')
  )
);

create unique index payment_gateway_configurations_provider_unique
  on public.payment_gateway_configurations (provider);

alter table public.payment_gateway_state enable row level security;
alter table public.payment_gateway_configurations enable row level security;
revoke all on table public.payment_gateway_state from public, anon, authenticated;
revoke all on table public.payment_gateway_configurations from public, anon, authenticated;
grant select on table public.payment_gateway_state to service_role;
grant select on table public.payment_gateway_configurations to service_role;

create or replace function public.admin_list_payment_gateways()
returns table (
  gateway_id uuid,
  provider text,
  display_name text,
  key_id text,
  mode text,
  enabled boolean,
  key_secret_configured boolean,
  webhook_secret_configured boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select g.id, g.provider, g.display_name, g.key_id, g.mode, g.enabled,
    (length(g.encrypted_key_secret) > 0),
    (length(g.encrypted_webhook_secret) > 0), g.updated_at
  from public.payment_gateway_configurations g
  order by g.updated_at desc;
end;
$$;

create or replace function public.admin_save_payment_gateway(
  p_gateway_id uuid,
  p_provider text,
  p_display_name text,
  p_key_id text,
  p_encrypted_key_secret text,
  p_encrypted_webhook_secret text,
  p_mode text,
  p_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_gateway_id uuid;
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  if p_provider is distinct from 'razorpay'
    or length(btrim(coalesce(p_display_name, ''))) not between 2 and 80
    or p_key_id is null or length(p_key_id) not between 12 and 128
    or p_encrypted_key_secret is null or length(p_encrypted_key_secret) not between 32 and 1200
    or p_encrypted_webhook_secret is null or length(p_encrypted_webhook_secret) not between 32 and 1200
    or p_encrypted_key_secret !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    or p_encrypted_webhook_secret !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    or p_mode is null or p_mode not in ('test', 'live')
    or (p_mode = 'test' and p_key_id not like 'rzp_test_%')
    or (p_mode = 'live' and p_key_id not like 'rzp_live_%')
  then
    raise exception 'Invalid payment gateway settings';
  end if;

  if p_gateway_id is null then
    insert into public.payment_gateway_configurations (
      provider, display_name, key_id, encrypted_key_secret,
      encrypted_webhook_secret, mode, enabled, created_by, updated_by
    ) values (
      p_provider, btrim(p_display_name), p_key_id, p_encrypted_key_secret,
      p_encrypted_webhook_secret, p_mode, coalesce(p_enabled, false), v_actor, v_actor
    ) returning id into v_gateway_id;
  else
    select jsonb_build_object(
      'provider', provider, 'display_name', display_name,
      'key_id', key_id, 'mode', mode, 'enabled', enabled
    ) into v_previous
    from public.payment_gateway_configurations
    where id = p_gateway_id
    for update;
    if not found then raise exception 'Payment gateway not found'; end if;
    update public.payment_gateway_configurations set
      display_name = btrim(p_display_name), key_id = p_key_id,
      encrypted_key_secret = p_encrypted_key_secret,
      encrypted_webhook_secret = p_encrypted_webhook_secret,
      mode = p_mode, enabled = coalesce(p_enabled, false),
      updated_by = v_actor, updated_at = now()
    where id = p_gateway_id returning id into v_gateway_id;
  end if;

  update public.payment_gateway_state set
    admin_managed = true, updated_by = v_actor, updated_at = now()
  where id = true;

  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value, new_value
  ) values (
    v_actor,
    case when p_gateway_id is null then 'payment_gateway.created' else 'payment_gateway.updated' end,
    'payments', 'payment_gateway_configurations', v_gateway_id, v_previous,
    jsonb_build_object(
      'provider', p_provider, 'display_name', btrim(p_display_name),
      'key_id', p_key_id, 'mode', p_mode, 'enabled', p_enabled
    )
  );
  return v_gateway_id;
end;
$$;

create or replace function public.admin_delete_payment_gateway(p_gateway_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  select jsonb_build_object(
    'provider', provider, 'display_name', display_name,
    'key_id', key_id, 'mode', mode, 'enabled', enabled
  ) into v_previous
  from public.payment_gateway_configurations
  where id = p_gateway_id
  for update;
  if not found then raise exception 'Payment gateway not found'; end if;

  update public.payment_gateway_configurations set
    enabled = false, updated_by = v_actor, updated_at = now()
  where id = p_gateway_id;
  update public.payment_gateway_state set
    admin_managed = true, updated_by = v_actor, updated_at = now()
  where id = true;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value
  ) values (
    v_actor, 'payment_gateway.removed', 'payments',
    'payment_gateway_configurations', p_gateway_id, v_previous
  );
end;
$$;

revoke all on function public.admin_list_payment_gateways() from public, anon;
revoke all on function public.admin_save_payment_gateway(uuid, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_payment_gateway(uuid) from public, anon;
grant execute on function public.admin_list_payment_gateways() to authenticated;
grant execute on function public.admin_save_payment_gateway(uuid, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_payment_gateway(uuid) to authenticated;

