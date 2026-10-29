-- Expand the public DawaSetu directory to include approved hospitals,
-- nursing homes, diagnostic centres, and laboratories.
-- Public visibility remains controlled by business approval and the
-- public_availability_enabled setting; distributors stay excluded.
insert into public.business_types (slug, name, is_distributor, is_active)
values
  ('hospital', 'Hospital', false, true),
  ('nursing_home', 'Nursing Home', false, true),
  ('diagnostic_center', 'Diagnostic Centre', false, true),
  ('medical_laboratory', 'Medical Laboratory', false, true)
on conflict (slug) do update
set name = excluded.name,
    is_distributor = false,
    is_active = true;
