create or replace function public.notify_medicine_request_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_business_name text;
  v_medicine_name text;
  v_response_changed boolean;
begin
  select mr.customer_user_id, b.business_name, mr.requested_medicine_name
  into v_customer_id, v_business_name, v_medicine_name
  from public.medicine_requests mr
  join public.businesses b on b.id = new.business_id
  where mr.id = new.request_id;

  v_response_changed := tg_op = 'INSERT' or old.response is distinct from new.response;
  if new.response = 'available' then
    update public.medicine_requests set status = 'partially_fulfilled'
    where id = new.request_id and status = 'open' and expires_at > pg_catalog.now();
    if v_customer_id is not null and v_response_changed then
      insert into public.notifications (user_id, business_id, event_type, title, body, payload)
      values (
        v_customer_id, new.business_id, 'medicine_request_response',
        'A nearby partner may have your medicine',
        v_business_name || ' responded to your request for ' || v_medicine_name || '.',
        pg_catalog.jsonb_build_object('request_id', new.request_id, 'response_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;
