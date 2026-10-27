create table public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 160),
  image_path text not null unique check (
    image_path ~ '^/banners/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'
    or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  ),
  alt_text text not null check (length(trim(alt_text)) between 5 and 240),
  target_url text check (
    target_url is null
    or (
      length(target_url) <= 2048
      and target_url !~ '[[:space:]]'
      and position(chr(92) in target_url) = 0
      and (
        (left(target_url, 1) = '/' and left(target_url, 2) <> '//')
        or target_url ~ '^https://[^[:space:]]+$'
      )
    )
  ),
  display_order integer not null default 0 check (display_order between 0 and 999),
  is_active boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homepage_banners_public_order_idx
  on public.homepage_banners (display_order, created_at, id)
  where is_active;

create trigger homepage_banners_updated_at
before update on public.homepage_banners
for each row execute function public.set_updated_at();

alter table public.homepage_banners enable row level security;
revoke all on public.homepage_banners from anon, authenticated;

insert into public.homepage_banners (title, image_path, alt_text, target_url, display_order, is_active)
values (
  'DawaSetu connects people to pharmacies',
  '00000000-0000-4000-8000-000000000001.jpg',
  'DawaSetu helps customers find nearby pharmacy availability and helps pharmacy owners reach local customers.',
  '/pharmacies',
  0,
  true
)
on conflict (image_path) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-banners',
  'Homepage banners',
  true,
  700000,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant usage on schema storage to authenticated;
grant insert, delete on storage.objects to authenticated;

drop policy if exists "content managers upload homepage banners" on storage.objects;
create policy "content managers upload homepage banners"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'homepage-banners'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and public.has_platform_permission('content.manage')
);

drop policy if exists "content managers clean up failed homepage banner uploads" on storage.objects;
create policy "content managers clean up failed homepage banner uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'homepage-banners'
  and public.has_platform_permission('content.manage')
);

create or replace function public.list_public_homepage_banners()
returns table (
  id uuid,
  title text,
  image_path text,
  alt_text text,
  target_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title, b.image_path, b.alt_text, b.target_url
  from public.homepage_banners b
  where b.is_active
  order by b.display_order, b.created_at desc, b.id
  limit 20
$$;

create or replace function public.admin_list_homepage_banners()
returns table (
  banner_id uuid,
  title text,
  image_path text,
  alt_text text,
  target_url text,
  display_order integer,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select b.id, b.title, b.image_path, b.alt_text, b.target_url, b.display_order, b.is_active, b.created_at
  from public.homepage_banners b
  order by b.display_order, b.created_at desc, b.id;
end;
$$;

create or replace function public.admin_create_homepage_banner(
  p_title text,
  p_image_path text,
  p_alt_text text,
  p_target_url text,
  p_display_order integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_new jsonb;
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 2 and 160
    or p_image_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or length(trim(coalesce(p_alt_text, ''))) not between 5 and 240
    or p_display_order is null or p_display_order not between 0 and 999
    or p_is_active is null
    or (p_target_url is not null and (
      length(p_target_url) > 2048
      or p_target_url ~ '[[:space:]]'
      or position(chr(92) in p_target_url) > 0
      or not (
        (left(p_target_url, 1) = '/' and left(p_target_url, 2) <> '//')
        or p_target_url ~ '^https://[^[:space:]]+$'
      )
    )) then
    raise exception 'Invalid homepage banner';
  end if;

  insert into public.homepage_banners (
    title, image_path, alt_text, target_url, display_order, is_active, created_by, updated_by
  ) values (
    trim(p_title), p_image_path, trim(p_alt_text), nullif(trim(p_target_url), ''),
    p_display_order, p_is_active, auth.uid(), auth.uid()
  ) returning id into v_id;

  select to_jsonb(b) into v_new from public.homepage_banners b where b.id = v_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (auth.uid(), 'create', 'content', 'homepage_banners', v_id, v_new);
  return v_id;
end;
$$;

create or replace function public.admin_set_homepage_banner_active(
  p_banner_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous jsonb;
  v_new jsonb;
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  if p_banner_id is null or p_is_active is null then
    raise exception 'Invalid homepage banner';
  end if;
  select to_jsonb(b) into v_previous from public.homepage_banners b where b.id = p_banner_id;
  if v_previous is null then raise exception 'Homepage banner not found'; end if;
  update public.homepage_banners
  set is_active = p_is_active, updated_by = auth.uid()
  where id = p_banner_id;
  select to_jsonb(b) into v_new from public.homepage_banners b where b.id = p_banner_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (auth.uid(), 'visibility.update', 'content', 'homepage_banners', p_banner_id, v_previous, v_new);
end;
$$;

revoke all on function public.list_public_homepage_banners() from public;
revoke all on function public.admin_list_homepage_banners() from public, anon;
revoke all on function public.admin_create_homepage_banner(text, text, text, text, integer, boolean) from public, anon;
revoke all on function public.admin_set_homepage_banner_active(uuid, boolean) from public, anon;

grant execute on function public.list_public_homepage_banners() to anon, authenticated;
grant execute on function public.admin_list_homepage_banners() to authenticated;
grant execute on function public.admin_create_homepage_banner(text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_set_homepage_banner_active(uuid, boolean) to authenticated;
