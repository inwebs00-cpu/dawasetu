create or replace function public.get_my_security_recovery_settings()
returns table (
  recovery_email text,
  recovery_phone_e164 text,
  has_security_pin boolean,
  mfa_enabled boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select ss.recovery_email, ss.recovery_phone_e164,
    ss.security_pin_hash is not null, ss.mfa_enabled
  from public.security_settings ss
  where ss.user_id = auth.uid();
  if not found then
    return query select null::text, null::text, false, false;
  end if;
end;
$$;

create or replace function public.save_my_security_recovery_contacts(
  p_recovery_email text,
  p_recovery_phone_e164 text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_auth_phone text;
  v_phone_confirmed_at timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_recovery_email is null and p_recovery_phone_e164 is null then
    raise exception 'At least one verified recovery method is required';
  end if;
  select u.email, u.email_confirmed_at, u.phone, u.phone_confirmed_at
  into v_auth_email, v_email_confirmed_at, v_auth_phone, v_phone_confirmed_at
  from auth.users u where u.id = v_user_id;
  if p_recovery_email is not null and (
    v_email_confirmed_at is null or v_auth_email is null
    or lower(p_recovery_email) <> lower(v_auth_email)
  ) then
    raise exception 'Recovery email must be verified on the account';
  end if;
  if p_recovery_phone_e164 is not null and (
    v_phone_confirmed_at is null or v_auth_phone is null
    or p_recovery_phone_e164 <> v_auth_phone
  ) then
    raise exception 'Recovery phone must be verified on the account';
  end if;

  insert into public.security_settings(user_id, recovery_email, recovery_phone_e164)
  values (v_user_id, lower(p_recovery_email), p_recovery_phone_e164)
  on conflict (user_id) do update set
    recovery_email = excluded.recovery_email,
    recovery_phone_e164 = excluded.recovery_phone_e164,
    updated_at = now();

  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, new_value
  ) values (
    v_user_id, 'security.recovery_contacts_updated', 'security', 'security_settings', v_user_id,
    jsonb_build_object(
      'has_recovery_email', p_recovery_email is not null,
      'has_recovery_phone', p_recovery_phone_e164 is not null
    )
  );
end;
$$;

create or replace function public.service_save_security_pin_hash(
  p_user_id uuid,
  p_pin_hash text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_had_pin boolean;
begin
  if p_user_id is null or p_pin_hash is null
    or p_pin_hash !~ '^scrypt\$[0-9]{4,6}\$[1-9][0-9]*\$[1-9][0-9]*\$[0-9a-f]{32}\$[0-9a-f]{128}$' then
    raise exception 'Invalid security PIN hash';
  end if;
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'User not found';
  end if;
  select ss.security_pin_hash is not null into v_had_pin
  from public.security_settings ss where ss.user_id = p_user_id;
  v_had_pin := coalesce(v_had_pin, false);

  insert into public.security_settings(user_id, security_pin_hash, failed_attempt_count, locked_until)
  values (p_user_id, p_pin_hash, 0, null)
  on conflict (user_id) do update set
    security_pin_hash = excluded.security_pin_hash,
    failed_attempt_count = 0,
    locked_until = null,
    last_failed_attempt_at = null,
    updated_at = now();

  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value, new_value
  ) values (
    p_user_id,
    case when v_had_pin then 'security.pin_reset' else 'security.pin_created' end,
    'security', 'security_settings', p_user_id,
    jsonb_build_object('has_security_pin', v_had_pin),
    jsonb_build_object('has_security_pin', true)
  );
end;
$$;

create or replace function public.service_record_security_pin_attempt(
  p_user_id uuid,
  p_succeeded boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_settings public.security_settings%rowtype;
  v_attempts integer;
begin
  if p_user_id is null or p_succeeded is null then
    raise exception 'Invalid security PIN attempt';
  end if;
  select ss.* into v_settings from public.security_settings ss
  where ss.user_id = p_user_id for update;
  if not found or v_settings.security_pin_hash is null then return false; end if;
  if v_settings.locked_until is not null and v_settings.locked_until > now() then
    return false;
  end if;
  if p_succeeded then
    update public.security_settings set
      failed_attempt_count = 0,
      locked_until = null,
      last_failed_attempt_at = null,
      updated_at = now()
    where user_id = p_user_id;
    return true;
  end if;

  v_attempts := case
    when v_settings.locked_until is not null and v_settings.locked_until <= now() then 1
    else v_settings.failed_attempt_count + 1
  end;
  update public.security_settings set
    failed_attempt_count = v_attempts,
    locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' else null end,
    last_failed_attempt_at = now(),
    updated_at = now()
  where user_id = p_user_id;
  if v_attempts = 5 then
    insert into public.audit_logs(
      actor_user_id, action, module, record_table, record_id, new_value
    ) values (
      p_user_id, 'security.pin_locked', 'security', 'security_settings', p_user_id,
      jsonb_build_object('locked_minutes', 15)
    );
  end if;
  return false;
end;
$$;

revoke all on function public.get_my_security_recovery_settings() from public, anon;
revoke all on function public.save_my_security_recovery_contacts(text, text) from public, anon;
revoke all on function public.service_save_security_pin_hash(uuid, text) from public, anon, authenticated;
revoke all on function public.service_record_security_pin_attempt(uuid, boolean) from public, anon, authenticated;
grant execute on function public.get_my_security_recovery_settings() to authenticated;
grant execute on function public.save_my_security_recovery_contacts(text, text) to authenticated;
grant select on public.security_settings to service_role;
grant execute on function public.service_save_security_pin_hash(uuid, text) to service_role;
grant execute on function public.service_record_security_pin_attempt(uuid, boolean) to service_role;
