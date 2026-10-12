do $$
begin
  execute 'alter publication supabase_realtime add table public.notifications';
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Realtime publication is not available; enable it before using live notifications.';
end;
$$;
