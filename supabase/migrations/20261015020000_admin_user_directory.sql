create or replace function public.admin_list_users(
  p_search text default null,
  p_account_type text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  account_type text,
  user_status text,
  created_at timestamptz,
  last_login_at timestamptz,
  business_count bigint,
  business_types text[],
  platform_roles text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
begin
  if not public.has_platform_permission('users.view') then
    raise exception 'Permission denied';
  end if;
  if pg_catalog.length(coalesce(v_search, '')) > 120
    or (p_account_type is not null and p_account_type not in
      ('customer', 'partner', 'distributor', 'admin', 'team_member', 'super_admin'))
    or (p_status is not null and p_status not in ('active', 'inactive', 'suspended'))
    or p_limit not between 1 and 100
    or p_offset not between 0 and 10000 then
    raise exception 'Invalid user directory filter';
  end if;

  return query
  select u.id, u.full_name, au.email::text, u.phone_e164, u.account_type, u.status,
    u.created_at, au.last_sign_in_at,
    (select pg_catalog.count(*) from public.businesses b where b.owner_user_id = u.id),
    coalesce((
      select pg_catalog.array_agg(distinct bt.name order by bt.name)
      from public.businesses b
      join public.business_types bt on bt.id = b.business_type_id
      where b.owner_user_id = u.id
    ), array[]::text[]),
    coalesce((
      select pg_catalog.array_agg(distinct r.name order by r.name)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.business_id is null
      where ur.user_id = u.id and ur.business_id is null
    ), array[]::text[])
  from public.users u
  join auth.users au on au.id = u.id
  where (p_account_type is null or u.account_type = p_account_type)
    and (p_status is null or u.status = p_status)
    and (v_search is null
      or pg_catalog.strpos(pg_catalog.lower(u.full_name), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(au.email, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(coalesce(u.phone_e164, ''), v_search) > 0)
  order by u.created_at desc, u.id
  limit p_limit offset p_offset;
end;
$$;

create table public.admin_action_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action_key text not null check (action_key = 'user.status.change'),
  target_id uuid not null,
  requested_value text not null,
  reason text not null check (length(reason) between 1 and 500),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_action_authorizations_expiry_idx
  on public.admin_action_authorizations(expires_at)
  where consumed_at is null;
alter table public.admin_action_authorizations enable row level security;
revoke all on public.admin_action_authorizations from public, anon, authenticated;
grant insert, select on public.admin_action_authorizations to service_role;

create or replace function public.admin_set_user_status(
  p_authorization_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_user_id uuid;
  v_status text;
  v_old_status text;
  v_reason text;
begin
  if v_actor is null or not public.has_platform_permission('users.manage') then
    raise exception 'Permission denied';
  end if;
  if p_authorization_id is null then
    raise exception 'Password confirmation is required';
  end if;

  select a.target_id, a.requested_value, a.reason
    into v_user_id, v_status, v_reason
  from public.admin_action_authorizations a
  where a.id = p_authorization_id
    and a.user_id = v_actor
    and a.action_key = 'user.status.change'
    and a.expires_at > pg_catalog.now()
    and a.consumed_at is null
  for update;
  if not found then
    raise exception 'Password confirmation is missing or expired';
  end if;
  update public.admin_action_authorizations
    set consumed_at = pg_catalog.now()
  where id = p_authorization_id;

  if v_user_id is null or v_user_id = v_actor then
    raise exception 'Administrators cannot change their own account status';
  end if;
  if v_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Invalid user status';
  end if;
  if pg_catalog.length(v_reason) not between 5 and 500 then
    raise exception 'Provide a reason between 5 and 500 characters';
  end if;

  select u.status into v_old_status
  from public.users u where u.id = v_user_id for update;
  if not found then raise exception 'User account not found'; end if;
  if v_status <> 'active' and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.business_id is null and r.slug = 'super_admin'
    where ur.user_id = v_user_id and ur.business_id is null
      and (select pg_catalog.count(*)
        from public.user_roles active_ur
        join public.users active_u on active_u.id = active_ur.user_id and active_u.status = 'active'
        where active_ur.role_id = r.id and active_ur.business_id is null) < 2
  ) then
    raise exception 'Cannot suspend the last active Super Admin';
  end if;

  update public.users set status = v_status where id = v_user_id;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id,
    previous_value, new_value, metadata
  ) values (
    v_actor,
    'user.status_changed',
    'users',
    'users',
    v_user_id,
    pg_catalog.jsonb_build_object('status', v_old_status),
    pg_catalog.jsonb_build_object('status', v_status),
    pg_catalog.jsonb_build_object('reason', v_reason)
  );
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_set_user_status(uuid) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_user_status(uuid) to authenticated;
