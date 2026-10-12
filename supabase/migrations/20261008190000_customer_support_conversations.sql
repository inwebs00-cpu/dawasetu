create or replace function public.add_my_support_ticket_message(
  p_ticket_id uuid,
  p_message text
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
  if v_actor is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_message, ''))) not between 1 and 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;
  select * into v_ticket from public.support_tickets
  where id = p_ticket_id and requester_user_id = v_actor
  for update;
  if not found then raise exception 'Support ticket not found'; end if;
  if v_ticket.status in ('resolved', 'closed') then
    raise exception 'This ticket is closed to replies';
  end if;
  if (select count(*) from public.support_ticket_messages m
      where m.ticket_id = p_ticket_id and m.author_user_id = v_actor
        and m.created_at > now() - interval '5 minutes') >= 5 then
    raise exception 'Please wait before sending another ticket reply';
  end if;

  insert into public.support_ticket_messages(ticket_id, author_user_id, message, is_internal)
  values (p_ticket_id, v_actor, trim(p_message), false);
  update public.support_tickets set
    status = case when status = 'waiting' then 'open' else status end,
    updated_at = now()
  where id = p_ticket_id;
  if v_ticket.assigned_to is not null then
    insert into public.notifications(user_id, business_id, event_type, title, body, payload)
    values (v_ticket.assigned_to, v_ticket.business_id, 'support_ticket_reply',
      'Customer replied to a support ticket',
      'A customer added a reply to support ticket #' || v_ticket.ticket_number || '.',
      jsonb_build_object('ticket_id', p_ticket_id, 'ticket_number', v_ticket.ticket_number));
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, metadata)
  values (v_actor, 'support_ticket.replied', 'support', 'support_tickets', p_ticket_id,
    jsonb_build_object('ticket_number', v_ticket.ticket_number));
  return v_ticket.ticket_number;
end;
$$;

revoke all on function public.add_my_support_ticket_message(uuid, text) from public, anon;
grant execute on function public.add_my_support_ticket_message(uuid, text) to authenticated;
