create or replace function public.admin_list_support_tickets(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  ticket_id uuid,
  ticket_number bigint,
  requester_name text,
  requester_phone text,
  business_name text,
  category text,
  subject text,
  description text,
  priority text,
  status text,
  assigned_to uuid,
  assigned_name text,
  created_at timestamptz,
  updated_at timestamptz,
  messages jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('support.manage') then
    raise exception 'Permission denied';
  end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then
    raise exception 'Invalid support ticket status';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination';
  end if;

  return query
  select st.id,
    st.ticket_number,
    requester.full_name,
    requester.phone_e164,
    b.business_name,
    st.category,
    st.subject,
    st.description,
    st.priority,
    st.status,
    st.assigned_to,
    assigned.full_name,
    st.created_at,
    st.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id', stm.id,
        'author_name', coalesce(author.full_name, 'DawaSetu team'),
        'message', stm.message,
        'is_internal', stm.is_internal,
        'created_at', stm.created_at
      ) order by stm.created_at, stm.id)
      from public.support_ticket_messages stm
      left join public.users author on author.id = stm.author_user_id
      where stm.ticket_id = st.id
    ), '[]'::jsonb)
  from public.support_tickets st
  join public.users requester on requester.id = st.requester_user_id
  left join public.businesses b on b.id = st.business_id
  left join public.users assigned on assigned.id = st.assigned_to
  where p_status is null or st.status = p_status
  order by case st.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
    st.created_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text,
  p_message text default null,
  p_internal boolean default false,
  p_assign_to_me boolean default false
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
  if p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then
    raise exception 'Invalid support ticket status';
  end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid support ticket priority';
  end if;
  if p_message is not null and length(trim(p_message)) not between 1 and 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;
  if p_internal and nullif(trim(p_message), '') is null then
    raise exception 'An internal note requires a message';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;

  update public.support_tickets set
    status = p_status,
    priority = p_priority,
    assigned_to = case when p_assign_to_me then v_actor else assigned_to end,
    resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
    updated_at = now()
  where id = p_ticket_id;

  if nullif(trim(p_message), '') is not null then
    insert into public.support_ticket_messages(ticket_id, author_user_id, message, is_internal)
    values (p_ticket_id, v_actor, trim(p_message), coalesce(p_internal, false));
  end if;

  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (
    v_actor,
    'support_ticket.updated',
    'support',
    'support_tickets',
    p_ticket_id,
    jsonb_build_object('status', v_ticket.status, 'priority', v_ticket.priority, 'assigned_to', v_ticket.assigned_to),
    jsonb_build_object('status', p_status, 'priority', p_priority, 'assigned_to', case when p_assign_to_me then v_actor else v_ticket.assigned_to end)
  );

  return v_ticket.ticket_number;
end;
$$;

revoke all on function public.admin_list_support_tickets(text, integer, integer) from public, anon;
revoke all on function public.admin_update_support_ticket(uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_list_support_tickets(text, integer, integer) to authenticated;
grant execute on function public.admin_update_support_ticket(uuid, text, text, text, boolean, boolean) to authenticated;
