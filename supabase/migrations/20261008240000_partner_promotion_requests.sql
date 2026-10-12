create or replace function public.list_my_business_promotions(p_business_id uuid)
returns table (
  promotion_id uuid,
  title text,
  description text,
  promotion_type text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_business_permission(p_business_id, 'promotions.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select p.id, p.title, p.description, p.promotion_type, p.status,
    p.starts_at, p.ends_at, p.updated_at
  from public.promotions p
  where p.business_id = p_business_id
  order by p.updated_at desc
  limit 50;
end;
$$;

create or replace function public.save_my_business_promotion(
  p_promotion_id uuid,
  p_business_id uuid,
  p_title text,
  p_description text,
  p_promotion_type text,
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
  if v_actor is null or not public.has_business_permission(p_business_id, 'promotions.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 2 and 160
    or length(coalesce(p_description, '')) > 1000
    or p_promotion_type not in ('offer', 'featured_listing', 'sponsored_listing')
    or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at)
  then
    raise exception 'Invalid promotion details';
  end if;
  if not exists (
    select 1 from public.businesses b
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where b.id = p_business_id and b.status = 'approved'
  ) then
    raise exception 'Approved partner not found';
  end if;
  if p_promotion_id is null then
    insert into public.promotions(
      business_id, title, description, promotion_type, status, starts_at, ends_at
    ) values (
      p_business_id, trim(p_title), nullif(trim(p_description), ''), p_promotion_type,
      'pending', p_starts_at, p_ends_at
    ) returning id into v_promotion_id;
  else
    select to_jsonb(p) into v_previous from public.promotions p
    where p.id = p_promotion_id and p.business_id = p_business_id
      and p.status in ('pending', 'rejected', 'cancelled')
    for update;
    if not found then raise exception 'Editable promotion request not found'; end if;
    update public.promotions set title = trim(p_title),
      description = nullif(trim(p_description), ''), promotion_type = p_promotion_type,
      status = 'pending', starts_at = p_starts_at, ends_at = p_ends_at,
      approved_by = null, updated_at = now()
    where id = p_promotion_id returning id into v_promotion_id;
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id,
    previous_value, new_value)
  values (v_actor, case when p_promotion_id is null then 'promotion.requested' else 'promotion.request_updated' end,
    'promotions', 'promotions', v_promotion_id, v_previous,
    jsonb_build_object('business_id', p_business_id, 'title', trim(p_title),
      'promotion_type', p_promotion_type, 'status', 'pending',
      'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_promotion_id;
end;
$$;

revoke all on function public.list_my_business_promotions(uuid) from public, anon;
revoke all on function public.save_my_business_promotion(uuid, uuid, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.list_my_business_promotions(uuid) to authenticated;
grant execute on function public.save_my_business_promotion(uuid, uuid, text, text, text, timestamptz, timestamptz) to authenticated;
