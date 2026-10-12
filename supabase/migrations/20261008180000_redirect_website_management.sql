create or replace function public.admin_list_redirect_websites()
returns table (
  redirect_id uuid,
  website_name text,
  website_url text,
  logo_path text,
  description text,
  button_text text,
  display_position integer,
  open_in_new_tab boolean,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  return query
  select rw.id, rw.name, rw.website_url, rw.logo_path, rw.description,
    rw.button_text, rw.display_position, rw.open_in_new_tab, rw.is_active, rw.updated_at
  from public.redirect_websites rw
  order by rw.display_position, rw.name;
end;
$$;

create or replace function public.admin_save_redirect_website(
  p_redirect_id uuid,
  p_name text,
  p_website_url text,
  p_logo_path text,
  p_description text,
  p_button_text text,
  p_display_position integer,
  p_open_in_new_tab boolean,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_redirect_id uuid;
  v_previous jsonb;
  v_url text := trim(coalesce(p_website_url, ''));
begin
  if v_actor is null or not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 100
    or length(v_url) > 2048
    or v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    or length(coalesce(p_logo_path, '')) > 1000
    or length(coalesce(p_description, '')) > 1000
    or length(trim(coalesce(p_button_text, ''))) not between 2 and 80
    or p_display_position is null or p_display_position not between 0 and 10000
    or p_open_in_new_tab is null or p_is_active is null
  then
    raise exception 'Invalid redirect website fields';
  end if;
  if p_redirect_id is null then
    insert into public.redirect_websites(
      name, website_url, logo_path, description, button_text,
      display_position, open_in_new_tab, is_active
    ) values (
      trim(p_name), v_url, nullif(trim(p_logo_path), ''),
      nullif(trim(p_description), ''), trim(p_button_text),
      p_display_position, p_open_in_new_tab, p_is_active
    ) returning id into v_redirect_id;
  else
    select to_jsonb(rw) into v_previous from public.redirect_websites rw
    where rw.id = p_redirect_id for update;
    if not found then raise exception 'Redirect website not found'; end if;
    update public.redirect_websites set
      name = trim(p_name), website_url = v_url,
      logo_path = nullif(trim(p_logo_path), ''),
      description = nullif(trim(p_description), ''),
      button_text = trim(p_button_text), display_position = p_display_position,
      open_in_new_tab = p_open_in_new_tab, is_active = p_is_active, updated_at = now()
    where id = p_redirect_id returning id into v_redirect_id;
  end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value, new_value)
  values (v_actor, case when p_redirect_id is null then 'redirect_website.created' else 'redirect_website.updated' end,
    'content', 'redirect_websites', v_redirect_id, v_previous,
    jsonb_build_object('name', trim(p_name), 'website_url', v_url, 'button_text', trim(p_button_text),
      'display_position', p_display_position, 'open_in_new_tab', p_open_in_new_tab, 'is_active', p_is_active));
  return v_redirect_id;
end;
$$;

create or replace function public.admin_delete_redirect_website(p_redirect_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
begin
  if v_actor is null or not public.has_platform_permission('content.manage') then
    raise exception 'Permission denied';
  end if;
  delete from public.redirect_websites where id = p_redirect_id returning to_jsonb(redirect_websites.*) into v_previous;
  if v_previous is null then raise exception 'Redirect website not found'; end if;
  insert into public.audit_logs(actor_user_id, action, module, record_table, record_id, previous_value)
  values (v_actor, 'redirect_website.deleted', 'content', 'redirect_websites', p_redirect_id, v_previous);
end;
$$;

revoke all on function public.admin_list_redirect_websites() from public, anon;
revoke all on function public.admin_save_redirect_website(uuid, text, text, text, text, text, integer, boolean, boolean) from public, anon;
revoke all on function public.admin_delete_redirect_website(uuid) from public, anon;
grant execute on function public.admin_list_redirect_websites() to authenticated;
grant execute on function public.admin_save_redirect_website(uuid, text, text, text, text, text, integer, boolean, boolean) to authenticated;
grant execute on function public.admin_delete_redirect_website(uuid) to authenticated;
