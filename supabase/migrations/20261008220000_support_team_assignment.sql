create or replace function public.admin_list_support_assignees()
returns table (user_id uuid, full_name text, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('support.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select distinct u.id, u.full_name, au.email::text
  from public.users u
  join auth.users au on au.id = u.id and au.email_confirmed_at is not null
  join public.user_roles ur on ur.user_id = u.id and ur.business_id is null
  join public.roles r on r.id = ur.role_id and r.business_id is null and r.is_active
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p on p.id = rp.permission_id and p.permission_key = 'support.manage'
  where u.status = 'active'
  order by u.full_name, au.email
  limit 100;
end;
$$;

create or replace function public.admin_assign_support_ticket(
  p_ticket_id uuid,
  p_assigned_to uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
begin
  if v_actor is null or not public.has_platform_permission('support.manage') then
    raise exception 'Permission denied';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id = u.id and ur.business_id is null
    join public.roles r on r.id = ur.role_id and r.business_id is null and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id and p.permission_key = 'support.manage'
    join auth.users au on au.id = u.id and au.email_confirmed_at is not null
    where u.id = p_assigned_to and u.status = 'active'
  ) then
    raise exception 'Active support team member not found';
  end if;
  select * into v_ticket from public.support_tickets
  where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;

  update public.support_tickets set assigned_to = p_assigned_to, updated_at = now()
  where id = p_ticket_id;
  if p_assigned_to is not null and p_assigned_to is distinct from v_ticket.assigned_to then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (p_assigned_to, v_ticket.business_id, 'support_ticket_assigned',
      'Support ticket assigned to you',
      'Support ticket #' || v_ticket.ticket_number || ' has been assigned to you.',
      jsonb_build_object('ticket_id', p_ticket_id, 'ticket_number', v_ticket.ticket_number));
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id,
    previous_value, new_value)
  values (v_actor, 'support_ticket.assigned', 'support', 'support_tickets', p_ticket_id,
    jsonb_build_object('assigned_to', v_ticket.assigned_to),
    jsonb_build_object('assigned_to', p_assigned_to));
  return v_ticket.ticket_number;
end;
$$;

revoke all on function public.admin_list_support_assignees() from public, anon;
revoke all on function public.admin_assign_support_ticket(uuid, uuid) from public, anon;
grant execute on function public.admin_list_support_assignees() to authenticated;
grant execute on function public.admin_assign_support_ticket(uuid, uuid) to authenticated;
