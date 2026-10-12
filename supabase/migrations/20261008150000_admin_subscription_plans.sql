create or replace function public.admin_list_subscription_plans()
returns table (
  plan_id uuid,
  plan_name text,
  plan_slug text,
  plan_description text,
  monthly_price_inr numeric,
  yearly_price_inr numeric,
  features jsonb,
  team_member_limit integer,
  inventory_limit integer,
  trial_days integer,
  is_active boolean,
  display_order integer,
  subscriber_count bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select sp.id, sp.name, sp.slug, sp.description, sp.monthly_price_inr,
    sp.yearly_price_inr, sp.features, sp.team_member_limit, sp.inventory_limit,
    sp.trial_days, sp.is_active, sp.display_order,
    (select count(*) from public.subscriptions s where s.plan_id = sp.id),
    sp.updated_at
  from public.subscription_plans sp
  order by sp.display_order, sp.name;
end;
$$;

create or replace function public.admin_save_subscription_plan(
  p_plan_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_monthly_price_inr numeric,
  p_yearly_price_inr numeric,
  p_team_member_limit integer,
  p_inventory_limit integer,
  p_trial_days integer,
  p_feature_keys text[],
  p_is_active boolean,
  p_display_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_plan_id uuid;
  v_previous jsonb;
  v_features jsonb;
  v_allowed_features constant text[] := array[
    'medicine_requests', 'analytics', 'featured_listing', 'promotions',
    'profile_media', 'team_members', 'inventory_exports'
  ];
  v_feature_keys text[] := coalesce(p_feature_keys, array[]::text[]);
begin
  if v_actor is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(p_name)) not between 2 and 100
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(coalesce(p_description, '')) > 1000
    or p_monthly_price_inr is null or p_monthly_price_inr < 0 or p_monthly_price_inr > 10000000
    or p_yearly_price_inr is null or p_yearly_price_inr < 0 or p_yearly_price_inr > 10000000
    or p_trial_days is null or p_trial_days not between 0 and 90
    or p_display_order is null or p_display_order not between 0 and 10000
    or (p_team_member_limit is not null and p_team_member_limit not between 0 and 100000)
    or (p_inventory_limit is not null and p_inventory_limit not between 0 and 10000000)
  then
    raise exception 'Invalid subscription plan fields';
  end if;
  if exists (select 1 from unnest(v_feature_keys) as f(key) where f.key <> all(v_allowed_features)) then
    raise exception 'Invalid subscription feature';
  end if;
  select coalesce(jsonb_object_agg(feature, true), '{}'::jsonb)
  into v_features from (select distinct unnest(v_feature_keys) as feature) keys;

  if p_plan_id is null then
    insert into public.subscription_plans(
      name, slug, description, monthly_price_inr, yearly_price_inr, features,
      team_member_limit, inventory_limit, trial_days, is_active, display_order
    ) values (
      trim(p_name), p_slug, nullif(trim(p_description), ''), p_monthly_price_inr,
      p_yearly_price_inr, v_features, p_team_member_limit, p_inventory_limit,
      p_trial_days, coalesce(p_is_active, true), p_display_order
    ) returning id into v_plan_id;
  else
    select to_jsonb(sp) into v_previous from public.subscription_plans sp
    where sp.id = p_plan_id for update;
    if not found then raise exception 'Subscription plan not found'; end if;
    update public.subscription_plans set
      name = trim(p_name), slug = p_slug, description = nullif(trim(p_description), ''),
      monthly_price_inr = p_monthly_price_inr, yearly_price_inr = p_yearly_price_inr,
      features = v_features, team_member_limit = p_team_member_limit,
      inventory_limit = p_inventory_limit, trial_days = p_trial_days,
      is_active = coalesce(p_is_active, false), display_order = p_display_order,
      updated_at = now()
    where id = p_plan_id returning id into v_plan_id;
  end if;

  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, case when p_plan_id is null then 'subscription_plan.created' else 'subscription_plan.updated' end,
    'payments', 'subscription_plans', v_plan_id, v_previous,
    jsonb_build_object('name', trim(p_name), 'slug', p_slug, 'monthly_price_inr', p_monthly_price_inr,
      'yearly_price_inr', p_yearly_price_inr, 'features', v_features, 'is_active', p_is_active));
  return v_plan_id;
end;
$$;

create or replace function public.admin_delete_subscription_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_plan public.subscription_plans%rowtype;
begin
  if v_actor is null or not public.has_platform_permission('payments.manage') then
    raise exception 'Permission denied';
  end if;
  select * into v_plan from public.subscription_plans where id = p_plan_id for update;
  if not found then raise exception 'Subscription plan not found'; end if;
  if exists (select 1 from public.subscriptions where plan_id = p_plan_id) then
    raise exception 'Plans with subscription history cannot be deleted; deactivate the plan instead';
  end if;
  if v_plan.is_active then raise exception 'Deactivate the plan before deleting it'; end if;
  delete from public.subscription_plans where id = p_plan_id;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value)
  values (v_actor, 'subscription_plan.deleted', 'payments', 'subscription_plans', p_plan_id, to_jsonb(v_plan));
end;
$$;

revoke all on function public.admin_list_subscription_plans() from public, anon;
revoke all on function public.admin_save_subscription_plan(uuid, text, text, text, numeric, numeric, integer, integer, integer, text[], boolean, integer) from public, anon;
revoke all on function public.admin_delete_subscription_plan(uuid) from public, anon;
grant execute on function public.admin_list_subscription_plans() to authenticated;
grant execute on function public.admin_save_subscription_plan(uuid, text, text, text, numeric, numeric, integer, integer, integer, text[], boolean, integer) to authenticated;
grant execute on function public.admin_delete_subscription_plan(uuid) to authenticated;
