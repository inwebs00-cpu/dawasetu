create or replace function public.admin_list_promotions()
returns table (
  promotion_id uuid,
  business_id uuid,
  business_name text,
  title text,
  description text,
  promotion_type text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('promotions.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select p.id, p.business_id, b.business_name, p.title, p.description,
    p.promotion_type, p.status, p.starts_at, p.ends_at, p.updated_at
  from public.promotions p
  left join public.businesses b on b.id = p.business_id
  order by p.updated_at desc, p.title
  limit 250;
end;
$$;

create or replace function public.admin_save_promotion(
  p_promotion_id uuid,
  p_business_id uuid,
  p_title text,
  p_description text,
  p_promotion_type text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_promotion_id uuid;
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('promotions.manage') then
    raise exception 'Permission denied';
  end if;
  if p_business_id is null
    or length(trim(coalesce(p_title, ''))) not between 2 and 160
    or length(coalesce(p_description, '')) > 1000
    or p_promotion_type not in ('offer', 'featured_listing', 'sponsored_listing')
    or p_status not in ('pending', 'approved', 'rejected', 'scheduled', 'active', 'expired', 'cancelled')
    or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at)
  then
    raise exception 'Invalid promotion details';
  end if;
  if not exists (
    select 1 from public.businesses b
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where b.id = p_business_id and b.status = 'approved'
  ) then
    raise exception 'Approved public partner not found';
  end if;
  if p_promotion_id is null then
    insert into public.promotions(
      business_id, title, description, promotion_type, status, starts_at, ends_at, approved_by
    ) values (
      p_business_id, trim(p_title), nullif(trim(p_description), ''), p_promotion_type,
      p_status, p_starts_at, p_ends_at,
      case when p_status in ('approved', 'scheduled', 'active') then v_actor else null end
    ) returning id into v_promotion_id;
  else
    select to_jsonb(p) into v_previous from public.promotions p
    where p.id = p_promotion_id for update;
    if not found then raise exception 'Promotion not found'; end if;
    update public.promotions set
      business_id = p_business_id, title = trim(p_title),
      description = nullif(trim(p_description), ''), promotion_type = p_promotion_type,
      status = p_status, starts_at = p_starts_at, ends_at = p_ends_at,
      approved_by = case when p_status in ('approved', 'scheduled', 'active') then v_actor else null end,
      updated_at = now()
    where id = p_promotion_id returning id into v_promotion_id;
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, case when p_promotion_id is null then 'promotion.created' else 'promotion.updated' end,
    'promotions', 'promotions', v_promotion_id, v_previous,
    jsonb_build_object('business_id', p_business_id, 'title', trim(p_title),
      'promotion_type', p_promotion_type, 'status', p_status,
      'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_promotion_id;
end;
$$;

create or replace function public.admin_delete_promotion(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('promotions.manage') then
    raise exception 'Permission denied';
  end if;
  delete from public.promotions where id = p_promotion_id returning to_jsonb(promotions.*) into v_previous;
  if v_previous is null then raise exception 'Promotion not found'; end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value)
  values (v_actor, 'promotion.deleted', 'promotions', 'promotions', p_promotion_id, v_previous);
end;
$$;

create or replace function public.admin_list_promotion_businesses()
returns table (business_id uuid, business_name text, business_type text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('promotions.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select b.id, b.business_name, bt.name
  from public.businesses b
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  where b.status = 'approved'
  order by b.business_name
  limit 500;
end;
$$;

create or replace function public.list_public_business_promotions(p_business_id uuid)
returns table (
  promotion_id uuid,
  title text,
  description text,
  promotion_type text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.description, p.promotion_type, p.starts_at, p.ends_at
  from public.promotions p
  join public.businesses b on b.id = p.business_id and b.status = 'approved'
    and b.public_availability_enabled
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  where p.business_id = p_business_id
    and p.status in ('approved', 'scheduled', 'active')
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
  order by case p.promotion_type when 'sponsored_listing' then 0 when 'featured_listing' then 1 else 2 end,
    p.starts_at nulls first, p.created_at desc
  limit 20;
$$;

revoke all on function public.admin_list_promotions() from public, anon;
revoke all on function public.admin_save_promotion(uuid, uuid, text, text, text, text, timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_delete_promotion(uuid) from public, anon;
revoke all on function public.admin_list_promotion_businesses() from public, anon;
revoke all on function public.list_public_business_promotions(uuid) from public;
grant execute on function public.admin_list_promotions() to authenticated;
grant execute on function public.admin_save_promotion(uuid, uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_delete_promotion(uuid) to authenticated;
grant execute on function public.admin_list_promotion_businesses() to authenticated;
grant execute on function public.list_public_business_promotions(uuid) to anon, authenticated;
