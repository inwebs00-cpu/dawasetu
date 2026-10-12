create or replace function public.audit_business_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(actor_user_id, role_slug, action, module, record_table, record_id, previous_value, new_value)
  values (
    auth.uid(),
    (select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and ur.business_id is null order by r.slug limit 1),
    'profile.update', 'partners', 'businesses', new.id,
    pg_catalog.to_jsonb(old), pg_catalog.to_jsonb(new)
  );
  return new;
end;
$$;
revoke all on function public.audit_business_profile_change() from public, anon, authenticated;
create trigger audit_business_profile_after_update
after update of business_name, description, logo_path, phone_e164, whatsapp_e164, email,
  address_line1, address_line2, area_id, postal_code, latitude, longitude, opening_hours,
  public_availability_enabled, google_business_url
on public.businesses
for each row execute function public.audit_business_profile_change();

create or replace function public.audit_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value, metadata)
  values (
    coalesce(new.updated_by, auth.uid()),
    case when tg_op = 'INSERT' then 'availability.add' else 'availability.update' end,
    'inventory', 'inventory', new.id,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('business_id', new.business_id, 'medicine_id', new.medicine_id)
  );
  return new;
end;
$$;
revoke all on function public.audit_inventory_change() from public, anon, authenticated;
create trigger audit_inventory_after_change
after insert or update on public.inventory
for each row execute function public.audit_inventory_change();

create or replace function public.audit_inventory_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_medicine_id uuid;
begin
  select i.business_id, i.medicine_id into v_business_id, v_medicine_id
  from public.inventory i where i.id = new.inventory_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value, metadata)
  values (
    coalesce(new.updated_by, auth.uid()),
    case when tg_op = 'INSERT' then 'visibility.enable_or_disable' else 'visibility.update' end,
    'inventory', 'inventory_visibility', new.inventory_id,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    pg_catalog.jsonb_build_object('business_id', v_business_id, 'medicine_id', v_medicine_id)
  );
  return new;
end;
$$;
revoke all on function public.audit_inventory_visibility_change() from public, anon, authenticated;
create trigger audit_inventory_visibility_after_change
after insert or update on public.inventory_visibility
for each row execute function public.audit_inventory_visibility_change();

create or replace function public.admin_list_audit_logs(
  p_module text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  log_id uuid,
  actor_user_id uuid,
  actor_name text,
  role_slug text,
  action text,
  module text,
  record_table text,
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('audit_logs.view') then raise exception 'Permission denied'; end if;
  if (p_module is not null and pg_catalog.length(p_module) > 80) or p_limit not between 1 and 100 or p_offset < 0 then raise exception 'Invalid audit filters'; end if;
  return query select al.id, al.actor_user_id, u.full_name, al.role_slug, al.action, al.module,
    al.record_table, al.record_id, al.previous_value, al.new_value, al.metadata, al.created_at
  from public.audit_logs al
  left join public.users u on u.id = al.actor_user_id
  where p_module is null or al.module = p_module
  order by al.created_at desc
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.admin_list_audit_logs(text, integer, integer) from public, anon;
grant execute on function public.admin_list_audit_logs(text, integer, integer) to authenticated;
