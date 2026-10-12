create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 200),
  summary text not null check (length(trim(summary)) between 1 and 500),
  content text not null check (length(trim(content)) between 1 and 30000),
  seo_title text check (seo_title is null or length(seo_title) <= 200),
  seo_description text check (seo_description is null or length(seo_description) <= 320),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_user_id uuid not null references public.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index content_posts_published_at_idx on public.content_posts(status, published_at desc) where status = 'published';
create index content_posts_title_lower_idx on public.content_posts(lower(title));
alter table public.content_posts enable row level security;
revoke all on public.content_posts from anon, authenticated;
grant select on public.content_posts to anon, authenticated;
create policy "published content is public" on public.content_posts for select to anon, authenticated
using (status = 'published' and published_at <= now());
create trigger set_updated_at_content_posts before update on public.content_posts
for each row execute function public.set_updated_at();

create or replace function public.admin_list_content_posts(p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  post_id uuid,
  slug text,
  title text,
  summary text,
  status text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('content.manage') then raise exception 'Permission denied'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_query, ''))) > 120 or p_limit not between 1 and 100 or p_offset < 0 then raise exception 'Invalid content filters'; end if;
  return query select p.id, p.slug, p.title, p.summary, p.status, p.published_at, p.updated_at
  from public.content_posts p
  where pg_catalog.btrim(coalesce(p_query, '')) = ''
    or p.title ilike '%' || pg_catalog.btrim(p_query) || '%'
    or p.slug ilike '%' || pg_catalog.btrim(p_query) || '%'
  order by case when p.status = 'draft' then 0 else 1 end, p.updated_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_get_content_post(p_post_id uuid)
returns table (
  post_id uuid,
  slug text,
  title text,
  summary text,
  content text,
  seo_title text,
  seo_description text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_permission('content.manage') then raise exception 'Permission denied'; end if;
  return query select p.id, p.slug, p.title, p.summary, p.content, p.seo_title, p.seo_description, p.status
  from public.content_posts p where p.id = p_post_id;
end;
$$;

create or replace function public.admin_save_content_post(
  p_post_id uuid,
  p_slug text,
  p_title text,
  p_summary text,
  p_content text,
  p_seo_title text,
  p_seo_description text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_previous jsonb;
  v_new jsonb;
  v_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
begin
  if not public.has_platform_permission('content.manage') then raise exception 'Permission denied'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_title, ''))) not between 1 and 200
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_summary, ''))) not between 1 and 500
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_content, ''))) not between 1 and 30000
    or pg_catalog.length(coalesce(p_seo_title, '')) > 200
    or pg_catalog.length(coalesce(p_seo_description, '')) > 320
    or p_status not in ('draft', 'published', 'archived') then raise exception 'Invalid post'; end if;
  if p_post_id is not null then
    select pg_catalog.to_jsonb(p) into v_previous from public.content_posts p where p.id = p_post_id;
    if v_previous is null then raise exception 'Post not found'; end if;
  end if;
  if p_post_id is null then
    insert into public.content_posts(slug, title, summary, content, seo_title, seo_description, status, author_user_id, published_at)
    values(v_slug, pg_catalog.btrim(p_title), pg_catalog.btrim(p_summary), pg_catalog.btrim(p_content), nullif(pg_catalog.btrim(p_seo_title), ''), nullif(pg_catalog.btrim(p_seo_description), ''), p_status, auth.uid(), case when p_status = 'published' then pg_catalog.now() else null end)
    returning id into v_id;
  else
    update public.content_posts set slug = v_slug, title = pg_catalog.btrim(p_title), summary = pg_catalog.btrim(p_summary), content = pg_catalog.btrim(p_content),
      seo_title = nullif(pg_catalog.btrim(p_seo_title), ''), seo_description = nullif(pg_catalog.btrim(p_seo_description), ''),
      status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, pg_catalog.now()) else null end,
      updated_at = pg_catalog.now()
    where id = p_post_id returning id into v_id;
  end if;
  select pg_catalog.to_jsonb(p) into v_new from public.content_posts p where p.id = v_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values(auth.uid(), case when p_post_id is null then 'create' else 'update' end, 'content', 'content_posts', v_id, v_previous, v_new);
  return v_id;
end;
$$;

revoke all on function public.admin_list_content_posts(text, integer, integer) from public, anon;
revoke all on function public.admin_get_content_post(uuid) from public, anon;
revoke all on function public.admin_save_content_post(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_list_content_posts(text, integer, integer) to authenticated;
grant execute on function public.admin_get_content_post(uuid) to authenticated;
grant execute on function public.admin_save_content_post(uuid, text, text, text, text, text, text, text) to authenticated;
