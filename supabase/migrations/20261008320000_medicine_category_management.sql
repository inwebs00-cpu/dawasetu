insert into public.categories (slug, name, display_order)
values
  ('pain-relief', 'Pain Relief', 10),
  ('antibiotics', 'Antibiotics', 20),
  ('diabetes-care', 'Diabetes Care', 30),
  ('cardiac-care', 'Cardiac Care', 40),
  ('vitamins-supplements', 'Vitamins & Supplements', 50),
  ('respiratory-care', 'Respiratory Care', 60),
  ('gastro-care', 'Gastro Care', 70),
  ('skin-care', 'Skin Care', 80)
on conflict do nothing;

create or replace function public.admin_list_medicine_categories()
returns table (
  category_id uuid,
  slug text,
  name text,
  description text,
  is_active boolean,
  display_order integer,
  medicine_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select c.id, c.slug, c.name, c.description, c.is_active, c.display_order,
    count(m.id)
  from public.categories c
  left join public.medicines m on m.category_id = c.id
  group by c.id
  order by c.display_order, c.name;
end;
$$;

create or replace function public.admin_save_medicine_category(
  p_category_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_display_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_previous jsonb;
  v_new jsonb;
begin
  if auth.uid() is null or not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_name is null or length(btrim(p_name)) not between 1 and 100
    or p_description is not null and length(btrim(p_description)) > 500
    or p_is_active is null or p_display_order is null or p_display_order not between 0 and 9999 then
    raise exception 'Invalid category details';
  end if;

  if p_category_id is null then
    insert into public.categories(slug, name, description, is_active, display_order)
    values (p_slug, btrim(p_name), nullif(btrim(p_description), ''), p_is_active, p_display_order)
    returning id into v_id;
  else
    select jsonb_build_object(
      'slug', c.slug, 'name', c.name, 'description', c.description,
      'is_active', c.is_active, 'display_order', c.display_order
    ) into v_previous
    from public.categories c where c.id = p_category_id for update;
    if not found then raise exception 'Category not found'; end if;
    update public.categories c set
      slug = p_slug,
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      is_active = p_is_active,
      display_order = p_display_order,
      updated_at = now()
    where c.id = p_category_id
    returning c.id into v_id;
  end if;

  select jsonb_build_object(
    'slug', c.slug, 'name', c.name, 'description', c.description,
    'is_active', c.is_active, 'display_order', c.display_order
  ) into v_new from public.categories c where c.id = v_id;
  insert into public.audit_logs(
    actor_user_id, action, module, record_table, record_id, previous_value, new_value
  ) values (
    auth.uid(),
    case when p_category_id is null then 'category.created' else 'category.updated' end,
    'content', 'categories', v_id, v_previous, v_new
  );
  return v_id;
end;
$$;

revoke all on function public.admin_list_medicine_categories() from public, anon;
revoke all on function public.admin_save_medicine_category(uuid, text, text, text, boolean, integer) from public, anon;
grant execute on function public.admin_list_medicine_categories() to authenticated;
grant execute on function public.admin_save_medicine_category(uuid, text, text, text, boolean, integer) to authenticated;
