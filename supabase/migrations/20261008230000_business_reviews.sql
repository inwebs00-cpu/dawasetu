create or replace function public.save_my_business_review(
  p_business_id uuid,
  p_rating smallint,
  p_review_text text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_review_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.users u where u.id = v_actor and u.status = 'active'
  ) then
    raise exception 'Active customer account required';
  end if;
  if p_rating is null or p_rating not between 1 and 5
    or length(coalesce(p_review_text, '')) > 2000
  then
    raise exception 'Invalid review details';
  end if;
  if not exists (
    select 1 from public.businesses b
    join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
    where b.id = p_business_id and b.status = 'approved'
      and b.public_availability_enabled and b.owner_user_id <> v_actor
  ) or public.is_active_business_member(p_business_id) then
    raise exception 'Public partner not found or review is not allowed';
  end if;
  insert into public.reviews(business_id, customer_user_id, rating, review_text, status, reviewed_by)
  values (p_business_id, v_actor, p_rating, nullif(trim(p_review_text), ''), 'pending', null)
  on conflict (business_id, customer_user_id) do update set
    rating = excluded.rating,
    review_text = excluded.review_text,
    status = 'pending',
    reviewed_by = null,
    updated_at = now()
  returning id into v_review_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, new_value)
  values (v_actor, 'business_review.submitted', 'reviews', 'reviews', v_review_id,
    jsonb_build_object('business_id', p_business_id, 'rating', p_rating));
  return v_review_id;
end;
$$;

create or replace function public.get_my_business_review(p_business_id uuid)
returns table (review_id uuid, rating smallint, review_text text, status text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.review_text, r.status, r.updated_at
  from public.reviews r
  where r.business_id = p_business_id and r.customer_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.list_public_business_reviews(p_business_id uuid)
returns table (review_id uuid, rating smallint, review_text text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.review_text, r.created_at
  from public.reviews r
  join public.businesses b on b.id = r.business_id
    and b.status = 'approved' and b.public_availability_enabled
  join public.business_types bt on bt.id = b.business_type_id and not bt.is_distributor
  where r.business_id = p_business_id and r.status = 'approved'
  order by r.created_at desc
  limit 50;
$$;

create or replace function public.admin_list_business_reviews(p_status text default 'pending')
returns table (
  review_id uuid,
  business_id uuid,
  business_name text,
  customer_name text,
  rating smallint,
  review_text text,
  review_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('partners.approve') then
    raise exception 'Permission denied';
  end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'hidden') then
    raise exception 'Invalid review status';
  end if;
  return query
  select r.id, r.business_id, b.business_name, u.full_name, r.rating,
    r.review_text, r.status, r.created_at, r.updated_at
  from public.reviews r
  join public.businesses b on b.id = r.business_id
  join public.users u on u.id = r.customer_user_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit 250;
end;
$$;

create or replace function public.admin_review_business_review(
  p_review_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_review public.reviews%rowtype;
begin
  if v_actor is null or not public.has_platform_permission('partners.approve') then
    raise exception 'Permission denied';
  end if;
  if p_decision not in ('approved', 'rejected', 'hidden') then
    raise exception 'Invalid review decision';
  end if;
  select * into v_review from public.reviews where id = p_review_id for update;
  if not found then raise exception 'Review not found'; end if;
  update public.reviews set status = p_decision, reviewed_by = v_actor, updated_at = now()
  where id = p_review_id;
  insert into public.notifications(user_id, event_type, title, body, payload)
  values (v_review.customer_user_id, 'business_review_moderated', 'Review status updated',
    case when p_decision = 'approved'
      then 'Your review is now visible on the partner profile.'
      else 'Your review was not published. You may edit and resubmit it.' end,
    jsonb_build_object('review_id', v_review.id, 'status', p_decision));
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id,
    previous_value, new_value)
  values (v_actor, 'business_review.moderated', 'reviews', 'reviews', p_review_id,
    jsonb_build_object('status', v_review.status), jsonb_build_object('status', p_decision));
end;
$$;

revoke all on function public.save_my_business_review(uuid, smallint, text) from public, anon;
revoke all on function public.get_my_business_review(uuid) from public, anon;
revoke all on function public.list_public_business_reviews(uuid) from public;
revoke all on function public.admin_list_business_reviews(text) from public, anon;
revoke all on function public.admin_review_business_review(uuid, text) from public, anon;
grant execute on function public.save_my_business_review(uuid, smallint, text) to authenticated;
grant execute on function public.get_my_business_review(uuid) to authenticated;
grant execute on function public.list_public_business_reviews(uuid) to anon, authenticated;
grant execute on function public.admin_list_business_reviews(text) to authenticated;
grant execute on function public.admin_review_business_review(uuid, text) to authenticated;
