insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  786432,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;

drop policy if exists "support users upload own attachments" on storage.objects;
create policy "support users upload own attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active'
  )
);

drop policy if exists "support participants read attached files" on storage.objects;
create policy "support participants read attached files"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    public.has_platform_permission('support.manage')
    or exists (
      select 1 from public.support_tickets st
      where st.attachment_path = storage.objects.name
        and st.requester_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.support_ticket_messages stm
      join public.support_tickets st on st.id = stm.ticket_id
      where stm.attachment_path = storage.objects.name
        and (st.requester_user_id = auth.uid() or public.has_platform_permission('support.manage'))
        and (not stm.is_internal or public.has_platform_permission('support.manage'))
    )
  )
);

drop policy if exists "support users remove unattached files" on storage.objects;
create policy "support users remove unattached files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
  and not exists (
    select 1 from public.support_tickets st
    where st.attachment_path = storage.objects.name
  )
  and not exists (
    select 1 from public.support_ticket_messages stm
    where stm.attachment_path = storage.objects.name
  )
);

drop policy "users create own support tickets" on public.support_tickets;
create policy "users create own support tickets" on public.support_tickets for insert to authenticated with check (
  requester_user_id = auth.uid()
  and status = 'open'
  and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text)
);

drop policy "requesters update own open tickets" on public.support_tickets;
create policy "requesters update own open tickets" on public.support_tickets for update to authenticated using (
  requester_user_id = auth.uid() and status in ('open', 'waiting')
) with check (
  requester_user_id = auth.uid()
  and status in ('open', 'waiting')
  and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text)
);

drop policy "users add public ticket messages" on public.support_ticket_messages;
create policy "users add public ticket messages" on public.support_ticket_messages for insert to authenticated with check (
  author_user_id = auth.uid()
  and not is_internal
  and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text)
  and exists (
    select 1 from public.support_tickets st
    where st.id = ticket_id and st.requester_user_id = auth.uid()
  )
);

drop function public.admin_list_support_tickets(text, integer, integer);
create function public.admin_list_support_tickets(
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
  attachment_path text,
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
    st.attachment_path,
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

revoke all on function public.admin_list_support_tickets(text, integer, integer) from public, anon;
grant execute on function public.admin_list_support_tickets(text, integer, integer) to authenticated;
