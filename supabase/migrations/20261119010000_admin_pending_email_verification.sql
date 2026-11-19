create or replace function public.admin_list_user_directory(
  p_search text default null,
  p_account_type text default null,
  p_status text default null,
  p_verification_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  account_type text,
  user_status text,
  email_confirmed_at timestamptz,
  verification_status text,
  created_at timestamptz,
  last_login_at timestamptz,
  business_count bigint,
  business_types text[],
  platform_roles text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
begin
  if not public.has_platform_permission('users.view') then
    raise exception 'Permission denied';
  end if;

  if pg_catalog.length(coalesce(v_search, '')) > 120
    or (p_account_type is not null and p_account_type not in
      ('customer', 'partner', 'distributor', 'admin', 'team_member', 'super_admin'))
    or (p_status is not null and p_status not in ('active', 'inactive', 'suspended'))
    or (p_verification_status is not null and p_verification_status not in ('pending', 'verified'))
    or p_limit not between 1 and 100
    or p_offset not between 0 and 10000 then
    raise exception 'Invalid user directory filter';
  end if;

  return query
  select
    au.id,
    coalesce(
      nullif(pg_catalog.btrim(au.raw_user_meta_data ->> 'display_name'), ''),
      nullif(pg_catalog.btrim(au.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(au.raw_user_meta_data ->> 'name'), ''),
      nullif(pg_catalog.btrim(u.full_name), ''),
      nullif(pg_catalog.split_part(coalesce(au.email, ''), '@', 1), ''),
      'DawaSetu User'
    ),
    au.email::text,
    coalesce(u.phone_e164, au.phone),
    coalesce(u.account_type, 'customer'),
    coalesce(u.status, 'active'),
    au.email_confirmed_at,
    case
      when au.email is null then 'no_email'
      when au.email_confirmed_at is null then 'pending'
      else 'verified'
    end,
    coalesce(u.created_at, au.created_at),
    au.last_sign_in_at,
    (
      select pg_catalog.count(*)
      from public.businesses b
      where b.owner_user_id = au.id
    ),
    coalesce((
      select pg_catalog.array_agg(distinct bt.name order by bt.name)
      from public.businesses b
      join public.business_types bt on bt.id = b.business_type_id
      where b.owner_user_id = au.id
    ), array[]::text[]),
    coalesce((
      select pg_catalog.array_agg(distinct r.name order by r.name)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.business_id is null
      where ur.user_id = au.id and ur.business_id is null
    ), array[]::text[])
  from auth.users au
  left join public.users u on u.id = au.id
  where (p_account_type is null or coalesce(u.account_type, 'customer') = p_account_type)
    and (p_status is null or coalesce(u.status, 'active') = p_status)
    and (p_verification_status is null
      or (p_verification_status = 'pending' and au.email is not null and au.email_confirmed_at is null)
      or (p_verification_status = 'verified' and au.email is not null and au.email_confirmed_at is not null))
    and (v_search is null
      or pg_catalog.strpos(pg_catalog.lower(coalesce(au.raw_user_meta_data ->> 'display_name', au.raw_user_meta_data ->> 'full_name', u.full_name, au.email, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'display_name', u.full_name, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(au.email, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(coalesce(u.phone_e164, au.phone, ''), v_search) > 0)
  order by coalesce(u.created_at, au.created_at) desc, au.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_list_user_directory(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_list_user_directory(text, text, text, text, integer, integer)
  to authenticated;
