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
    join public.roles r on r.id = ur.role_id and r.business_id is null and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = ur.user_id and u.status = 'active'
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

create or replace function public.service_sync_security_mfa(
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_previous boolean;
begin
  if p_user_id is null or p_enabled is null
    or not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.business_id is null and r.is_active
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      join public.users u on u.id = ur.user_id and u.status = 'active'
      where ur.user_id = p_user_id and ur.business_id is null
        and p.permission_key = 'security.manage'
    )
  then
    raise exception 'Security manager not found';
  end if;

  select coalesce(ss.mfa_enabled, false) into v_previous
  from public.security_settings ss where ss.user_id = p_user_id;
  v_previous := coalesce(v_previous, false);

  insert into public.security_settings(user_id, mfa_enabled)
  values (p_user_id, p_enabled)
  on conflict (user_id) do update set mfa_enabled = excluded.mfa_enabled,
    updated_at = now();

  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id,
    previous_value, new_value
  ) values (
    p_user_id,
    case when p_enabled then 'security.mfa_enabled' else 'security.mfa_disabled' end,
    'security', 'security_settings', p_user_id,
    jsonb_build_object('mfa_enabled', v_previous),
    jsonb_build_object('mfa_enabled', p_enabled)
  );
end;
$$;

revoke all on function public.service_sync_security_mfa(uuid, boolean) from public, anon, authenticated;
grant execute on function public.service_sync_security_mfa(uuid, boolean) to service_role;
