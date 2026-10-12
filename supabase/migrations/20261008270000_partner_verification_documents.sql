insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents',
  'business-documents',
  false,
  786432,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  uploaded_by uuid not null references public.users (id) on delete restrict,
  document_type text not null check (document_type in ('license', 'registration', 'insurance', 'other')),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null))
);

create index business_documents_business_status_created_idx
on public.business_documents (business_id, status, created_at desc);
create trigger business_documents_updated_at
before update on public.business_documents
for each row execute function public.set_updated_at();

alter table public.business_documents enable row level security;
grant select on public.business_documents to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.business_documents from anon, authenticated;

create policy "business members and partner reviewers read verification documents"
on public.business_documents for select to authenticated
using (
  public.has_platform_permission('partners.view')
  or public.has_platform_permission('partners.approve')
  or public.has_business_permission(business_id, 'partners.manage')
);

grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;
alter table storage.objects enable row level security;

drop policy if exists "partner members upload own business documents" on storage.objects;
create policy "partner members upload own business documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-documents'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.has_business_permission(split_part(name, '/', 1)::uuid, 'partners.manage')
);

drop policy if exists "authorized partners read verification files" on storage.objects;
create policy "authorized partners read verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1 from public.business_documents d
    where d.storage_path = storage.objects.name
      and (
        public.has_platform_permission('partners.view')
        or public.has_platform_permission('partners.approve')
        or public.has_business_permission(d.business_id, 'partners.manage')
      )
  )
);

create or replace function public.list_my_business_documents(p_business_id uuid)
returns table (
  document_id uuid,
  document_type text,
  storage_path text,
  status text,
  review_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_business_permission(p_business_id, 'partners.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select d.id, d.document_type, d.storage_path, d.status, d.review_note,
    d.created_at, d.updated_at
  from public.business_documents d
  where d.business_id = p_business_id
  order by d.created_at desc
  limit 50;
end;
$$;

create or replace function public.save_my_business_document(
  p_business_id uuid,
  p_document_type text,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_document_id uuid;
begin
  if v_actor is null or not public.has_business_permission(p_business_id, 'partners.manage') then
    raise exception 'Permission denied';
  end if;
  if p_document_type not in ('license', 'registration', 'insurance', 'other')
    or p_storage_path !~ ('^' || p_business_id::text || '/' || v_actor::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$')
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'business-documents' and o.name = p_storage_path
    )
  then
    raise exception 'Invalid verification document';
  end if;

  insert into public.business_documents(business_id, uploaded_by, document_type, storage_path)
  values (p_business_id, v_actor, p_document_type, p_storage_path)
  returning id into v_document_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (v_actor, 'partner.document_uploaded', 'partners', 'business_documents', v_document_id,
    jsonb_build_object('business_id', p_business_id, 'document_type', p_document_type, 'status', 'pending'));
  return v_document_id;
end;
$$;

create or replace function public.admin_list_business_documents(p_business_id uuid)
returns table (
  document_id uuid,
  document_type text,
  storage_path text,
  status text,
  review_note text,
  uploaded_by_name text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('partners.view')
    and not public.has_platform_permission('partners.approve')
    and not public.has_platform_permission('partners.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select d.id, d.document_type, d.storage_path, d.status, d.review_note,
    u.full_name, d.created_at, d.reviewed_at
  from public.business_documents d
  join public.users u on u.id = d.uploaded_by
  where d.business_id = p_business_id
  order by d.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_review_business_document(
  p_document_id uuid,
  p_status text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
  v_document public.business_documents%rowtype;
begin
  if v_actor is null or not public.has_platform_permission('partners.approve') then
    raise exception 'Permission denied';
  end if;
  if p_status not in ('approved', 'rejected') or length(coalesce(p_review_note, '')) > 1000 then
    raise exception 'Invalid document review';
  end if;
  select * into v_document from public.business_documents
  where id = p_document_id for update;
  if not found then raise exception 'Verification document not found'; end if;

  v_previous := to_jsonb(v_document);
  update public.business_documents set status = p_status, reviewed_by = v_actor,
    reviewed_at = now(), review_note = nullif(trim(p_review_note), '')
  where id = p_document_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, 'partner.document_reviewed', 'partners', 'business_documents', p_document_id,
    v_previous, jsonb_build_object('business_id', v_document.business_id, 'status', p_status,
      'review_note', nullif(trim(p_review_note), '')));
end;
$$;

create or replace function public.get_authorized_business_document_path(p_document_id uuid)
returns table (storage_path text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return query
  select d.storage_path from public.business_documents d
  where d.id = p_document_id
    and (public.has_platform_permission('partners.view')
      or public.has_platform_permission('partners.approve')
      or public.has_platform_permission('partners.manage')
      or public.has_business_permission(d.business_id, 'partners.manage'));
end;
$$;

revoke all on function public.list_my_business_documents(uuid) from public, anon;
revoke all on function public.save_my_business_document(uuid, text, text) from public, anon;
revoke all on function public.admin_list_business_documents(uuid) from public, anon;
revoke all on function public.admin_review_business_document(uuid, text, text) from public, anon;
revoke all on function public.get_authorized_business_document_path(uuid) from public, anon;
grant execute on function public.list_my_business_documents(uuid) to authenticated;
grant execute on function public.save_my_business_document(uuid, text, text) to authenticated;
grant execute on function public.admin_list_business_documents(uuid) to authenticated;
grant execute on function public.admin_review_business_document(uuid, text, text) to authenticated;
grant execute on function public.get_authorized_business_document_path(uuid) to authenticated;
