alter table public.users
  add column password_change_required boolean not null default false;

-- Used only to route an authenticated administrator before first-login
-- password rotation. All actual platform permissions remain blocked below.
create or replace function public.can_access_admin_portal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
      and r.business_id is null and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
      and p.permission_key = 'dashboard.view'
    join public.users u on u.id = ur.user_id and u.status = 'active'
    where ur.user_id = auth.uid() and ur.business_id is null
  );
$$;

revoke all on function public.can_access_admin_portal() from public, anon;
grant execute on function public.can_access_admin_portal() to authenticated;

create or replace function public.has_platform_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
      and r.business_id is null and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = ur.user_id
      and u.status = 'active' and not u.password_change_required
    where ur.user_id = auth.uid()
      and ur.business_id is null
      and p.permission_key = p_permission_key
      and (
        not exists (
          select 1 from public.security_settings ss
          where ss.user_id = ur.user_id and ss.mfa_enabled
        )
        or auth.jwt() ->> 'aal' = 'aal2'
      )
  );
$$;

create or replace function public.is_active_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    join public.users u on u.id = auth.uid()
      and u.status = 'active' and not u.password_change_required
    where b.id = p_business_id and b.owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.business_team_members tm
    join public.users u on u.id = tm.user_id
      and u.status = 'active' and not u.password_change_required
    where tm.business_id = p_business_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.has_business_permission(
  p_business_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    join public.users u on u.id = auth.uid()
      and u.status = 'active' and not u.password_change_required
    where b.id = p_business_id and b.owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.business_team_members tm
    join public.roles r on r.id = tm.role_id and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = tm.user_id
      and u.status = 'active' and not u.password_change_required
    where tm.business_id = p_business_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and (r.business_id = p_business_id or r.business_id is null)
      and p.permission_key = p_permission_key
  );
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
  from auth.users u
  join public.users p on p.id = u.id and p.status = 'active'
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
  if found then
    update public.users set password_change_required = true, updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (v_actor, 'team.role_assigned', 'team', 'user_roles', v_user_id,
    jsonb_build_object('email', lower(trim(p_email)), 'role_slug', v_slug));
  return v_user_id;
end;
$$;
