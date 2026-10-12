create or replace function public.admin_list_platform_team_members()
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  user_status text,
  role_id uuid,
  role_name text,
  role_slug text,
  role_is_system boolean,
  assigned_at timestamptz,
  last_login_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('team.manage') then
    raise exception 'Permission denied';
  end if;

  return query
  select u.id, u.full_name, au.email::text, u.phone_e164, u.status, r.id,
    r.name, r.slug, r.is_system, ur.created_at, au.last_sign_in_at
  from public.user_roles ur
  join public.users u on u.id = ur.user_id
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  join public.roles r on r.id = ur.role_id
  where ur.business_id is null and r.business_id is null
    and r.slug not in ('customer', 'partner', 'distributor')
  order by u.full_name, r.name;
end;
$$;

create or replace function public.admin_list_platform_roles()
returns table (
  role_id uuid,
  role_slug text,
  role_name text,
  description text,
  is_system boolean,
  is_active boolean,
  assigned_count bigint,
  permission_keys text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('team.manage') then
    raise exception 'Permission denied';
  end if;

  return query
  select r.id, r.slug, r.name, r.description, r.is_system, r.is_active,
    (select count(*) from public.user_roles ur where ur.role_id = r.id and ur.business_id is null),
    coalesce(array_agg(p.permission_key order by p.module, p.action)
      filter (where p.permission_key is not null), array[]::text[])
  from public.roles r
  left join public.role_permissions rp on rp.role_id = r.id
  left join public.permissions p on p.id = rp.permission_id
  where r.business_id is null
  group by r.id
  order by r.is_system desc, r.name;
end;
$$;

create or replace function public.admin_list_platform_permissions()
returns table (permission_key text, module text, description text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('security.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select p.permission_key, p.module, p.description
  from public.permissions p
  where public.has_platform_permission(p.permission_key)
  order by p.module, p.action;
end;
$$;

create or replace function public.admin_save_platform_role(
  p_role_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_permission_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id uuid;
  v_previous jsonb;
  v_permissions text[] := coalesce(p_permission_keys, array[]::text[]);
begin
  if v_actor is null or not public.has_platform_permission('security.manage') then
    raise exception 'Permission denied';
  end if;
  if p_slug !~ '^[a-z][a-z0-9_]{1,47}$' or p_slug in ('customer', 'partner', 'distributor', 'super_admin', 'admin', 'team_member') then
    raise exception 'Invalid or reserved role slug';
  end if;
  if length(trim(p_name)) not between 2 and 100 or length(coalesce(p_description, '')) > 500 then
    raise exception 'Invalid role name or description';
  end if;
  if cardinality(v_permissions) > 100 then raise exception 'Too many permissions'; end if;
  if exists (
    select 1 from unnest(v_permissions) as requested(key)
    where not public.has_platform_permission(requested.key)
  ) then
    raise exception 'Cannot grant a permission the current administrator does not have';
  end if;

  if p_role_id is null then
    insert into public.roles(business_id, slug, name, description, is_system, is_active)
    values (null, p_slug, trim(p_name), nullif(trim(p_description), ''), false, true)
    returning id into v_role_id;
  else
    select to_jsonb(r) into v_previous from public.roles r
    where r.id = p_role_id and r.business_id is null and not r.is_system
    for update;
    if not found then raise exception 'Custom platform role not found'; end if;
    update public.roles set slug = p_slug, name = trim(p_name),
      description = nullif(trim(p_description), ''), updated_at = now()
    where id = p_role_id returning id into v_role_id;
  end if;

  delete from public.role_permissions where role_id = v_role_id;
  insert into public.role_permissions(role_id, permission_id)
  select v_role_id, p.id from public.permissions p
  where p.permission_key = any(v_permissions);

  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, case when p_role_id is null then 'role.created' else 'role.updated' end,
    'team', 'roles', v_role_id, v_previous,
    jsonb_build_object('slug', p_slug, 'name', trim(p_name), 'permissions', v_permissions));
  return v_role_id;
end;
$$;

create or replace function public.admin_assign_platform_role(p_email text, p_role_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_user_id uuid;
  v_slug text;
begin
  if v_actor is null or not public.has_platform_permission('security.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(p_email)) not between 5 and 320 then raise exception 'Invalid email'; end if;
  select u.id, r.slug into v_user_id, v_slug
  from auth.users u join public.users p on p.id = u.id and p.status = 'active'
  join public.roles r on r.id = p_role_id and r.business_id is null and r.is_active
  where lower(u.email) = lower(trim(p_email))
    and u.email_confirmed_at is not null
    and r.slug <> 'super_admin';
  if v_user_id is null then raise exception 'Active account or assignable platform role not found'; end if;
  if exists (
    select 1 from public.role_permissions target_rp
    join public.permissions target_p on target_p.id = target_rp.permission_id
    where target_rp.role_id = p_role_id
      and not public.has_platform_permission(target_p.permission_key)
  ) then
    raise exception 'Cannot assign a role with permissions the current administrator does not have';
  end if;

  insert into public.user_roles(user_id, role_id, business_id, assigned_by)
  values (v_user_id, p_role_id, null, v_actor)
  on conflict (user_id, role_id) where business_id is null do nothing;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (v_actor, 'team.role_assigned', 'team', 'user_roles', v_user_id,
    jsonb_build_object('email', lower(trim(p_email)), 'role_slug', v_slug));
  return v_user_id;
end;
$$;

create or replace function public.admin_remove_platform_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_slug text;
begin
  if v_actor is null or not public.has_platform_permission('security.manage') then
    raise exception 'Permission denied';
  end if;
  if p_user_id = v_actor then raise exception 'Administrators cannot change their own platform roles'; end if;
  select r.slug into v_slug from public.roles r
  where r.id = p_role_id and r.business_id is null and r.slug <> 'super_admin';
  if not found then raise exception 'Role cannot be removed'; end if;
  delete from public.user_roles where user_id = p_user_id and role_id = p_role_id and business_id is null;
  if not found then raise exception 'Platform role assignment not found'; end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value)
  values (v_actor, 'team.role_removed', 'team', 'user_roles', p_user_id,
    jsonb_build_object('role_slug', v_slug));
end;
$$;

create or replace function public.admin_set_platform_team_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_old_status text;
begin
  if v_actor is null or not public.has_platform_permission('users.manage') then
    raise exception 'Permission denied';
  end if;
  if p_user_id = v_actor then raise exception 'Administrators cannot change their own account status'; end if;
  if p_status not in ('active', 'inactive', 'suspended') then raise exception 'Invalid user status'; end if;
  select u.status into v_old_status
  from public.users u
  where u.id = p_user_id and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = u.id and ur.business_id is null and r.business_id is null
      and r.slug not in ('customer', 'partner', 'distributor')
  )
  for update;
  if not found then raise exception 'Platform team account not found'; end if;
  if p_status <> 'active' and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and ur.business_id is null and r.business_id is null
      and r.slug = 'super_admin'
      and (select count(*) from public.user_roles active_ur
        join public.users active_u on active_u.id = active_ur.user_id and active_u.status = 'active'
        where active_ur.business_id is null and active_ur.role_id = r.id) < 2
  ) then
    raise exception 'Cannot suspend the last active Super Admin';
  end if;

  update public.users set status = p_status where id = p_user_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, 'team.user_status_changed', 'team', 'users', p_user_id,
    jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.admin_list_platform_team_members() from public, anon;
revoke all on function public.admin_list_platform_roles() from public, anon;
revoke all on function public.admin_list_platform_permissions() from public, anon;
revoke all on function public.admin_save_platform_role(uuid, text, text, text, text[]) from public, anon;
revoke all on function public.admin_assign_platform_role(text, uuid) from public, anon;
revoke all on function public.admin_remove_platform_role(uuid, uuid) from public, anon;
revoke all on function public.admin_set_platform_team_status(uuid, text) from public, anon;
grant execute on function public.admin_list_platform_team_members() to authenticated;
grant execute on function public.admin_list_platform_roles() to authenticated;
grant execute on function public.admin_list_platform_permissions() to authenticated;
grant execute on function public.admin_save_platform_role(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.admin_assign_platform_role(text, uuid) to authenticated;
grant execute on function public.admin_remove_platform_role(uuid, uuid) to authenticated;
grant execute on function public.admin_set_platform_team_status(uuid, text) to authenticated;
