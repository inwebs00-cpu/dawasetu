-- DawaSetu core schema. Tables start with RLS enabled and no client policies.
-- Access is denied to anon/authenticated until the reviewed policies are added.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'customer'
    check (account_type in ('customer', 'partner', 'distributor', 'admin', 'team_member', 'super_admin')),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  phone_e164 text,
  preferred_language text not null default 'en' check (length(preferred_language) between 2 and 12),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_phone_e164_unique on public.users (phone_e164) where phone_e164 is not null;
create index users_account_type_status_idx on public.users (account_type, status);

create table public.business_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name text not null unique,
  is_distributor boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.business_types (slug, name, is_distributor) values
  ('retail_pharmacy', 'Retail Pharmacy', false),
  ('clinic_pharmacy', 'Clinic Pharmacy', false),
  ('nursing_home_pharmacy', 'Nursing Home Pharmacy', false),
  ('distributor', 'Distributor / Stockist', true)
on conflict (slug) do nothing;

create table public.states (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, code),
  unique (country_code, name)
);

create table public.districts (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states (id) on delete restrict,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (state_id, name),
  unique (state_id, code)
);

create index districts_state_id_idx on public.districts (state_id, is_active);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete restrict,
  name text not null,
  postal_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (district_id, name, postal_code)
);

create index areas_district_id_idx on public.areas (district_id, is_active);
create index areas_postal_code_idx on public.areas (postal_code) where postal_code is not null;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete restrict,
  business_type_id uuid not null references public.business_types (id) on delete restrict,
  business_name text not null check (length(trim(business_name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  registration_number text,
  description text,
  logo_path text,
  phone_e164 text not null,
  whatsapp_e164 text,
  email text,
  address_line1 text not null,
  address_line2 text,
  area_id uuid references public.areas (id) on delete set null,
  postal_code text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  opening_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  public_availability_enabled boolean not null default false,
  google_business_url text check (google_business_url is null or google_business_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (status <> 'approved' or reviewed_at is not null)
);

create index businesses_owner_user_id_idx on public.businesses (owner_user_id);
create index businesses_type_status_idx on public.businesses (business_type_id, status);
create index businesses_area_status_idx on public.businesses (area_id, status);
create index businesses_geo_idx on public.businesses (latitude, longitude) where latitude is not null;
create index businesses_public_lookup_idx on public.businesses (status, public_availability_enabled, area_id);
create index businesses_name_lower_idx on public.businesses (lower(business_name));

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create unique index roles_global_slug_unique on public.roles (slug) where business_id is null;
create index roles_business_active_idx on public.roles (business_id, is_active);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique check (permission_key ~ '^[a-z][a-z0-9_.]*$'),
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (module, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  assigned_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, business_id)
);

create unique index user_roles_global_unique on public.user_roles (user_id, role_id) where business_id is null;
create index user_roles_user_business_idx on public.user_roles (user_id, business_id);
create index user_roles_role_id_idx on public.user_roles (role_id);

create table public.business_team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  invited_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index business_team_members_user_status_idx on public.business_team_members (user_id, status);
create index business_team_members_role_idx on public.business_team_members (role_id, status);

create table public.compositions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  description text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create index compositions_name_lower_idx on public.compositions (normalized_name);

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  website_url text check (website_url is null or website_url ~ '^https://'),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create index manufacturers_name_lower_idx on public.manufacturers (normalized_name);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (length(trim(product_name)) between 1 and 240),
  normalized_product_name text generated always as (lower(trim(product_name))) stored,
  brand_name text,
  composition_id uuid references public.compositions (id) on delete restrict,
  strength text not null,
  manufacturer_id uuid references public.manufacturers (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  medicine_type text not null check (medicine_type in ('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'device', 'other')),
  prescription_class text not null default 'unknown' check (prescription_class in ('prescription', 'otc', 'unknown')),
  packaging text,
  public_visibility boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'inactive')),
  submitted_by uuid references public.users (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_product_name, strength, manufacturer_id),
  check (status <> 'approved' or reviewed_at is not null)
);

create index medicines_product_name_lower_idx on public.medicines (normalized_product_name);
create index medicines_brand_name_lower_idx on public.medicines (lower(brand_name)) where brand_name is not null;
create index medicines_composition_strength_idx on public.medicines (composition_id, strength);
create index medicines_manufacturer_id_idx on public.medicines (manufacturer_id);
create index medicines_category_status_idx on public.medicines (category_id, status);
create index medicines_status_visibility_idx on public.medicines (status, public_visibility);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  status text not null default 'out_of_stock' check (status in ('available', 'low_stock', 'out_of_stock')),
  quantity integer check (quantity is null or quantity >= 0),
  updated_by uuid references public.users (id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, medicine_id),
  check (quantity is null or quantity > 0 or status = 'out_of_stock')
);

create index inventory_medicine_status_idx on public.inventory (medicine_id, status);
create index inventory_business_status_idx on public.inventory (business_id, status);
create index inventory_updated_at_idx on public.inventory (updated_at desc);

create table public.inventory_visibility (
  inventory_id uuid primary key references public.inventory (id) on delete cascade,
  public_visible boolean not null default false,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_visibility_public_idx on public.inventory_visibility (public_visible, updated_at desc);

create table public.medicine_requests (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.users (id) on delete restrict,
  medicine_id uuid references public.medicines (id) on delete set null,
  requested_medicine_name text not null check (length(trim(requested_medicine_name)) between 1 and 240),
  composition_text text,
  strength text,
  quantity integer not null default 1 check (quantity > 0),
  customer_area_id uuid references public.areas (id) on delete set null,
  customer_latitude numeric(9, 6) check (customer_latitude between -90 and 90),
  customer_longitude numeric(9, 6) check (customer_longitude between -180 and 180),
  contact_preference text not null default 'in_app' check (contact_preference in ('in_app', 'call', 'whatsapp')),
  contact_phone_e164 text,
  note text check (note is null or length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'partially_fulfilled', 'fulfilled', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((customer_latitude is null) = (customer_longitude is null)),
  check (expires_at > created_at)
);

create index medicine_requests_customer_status_idx on public.medicine_requests (customer_user_id, status, created_at desc);
create index medicine_requests_area_status_expiry_idx on public.medicine_requests (customer_area_id, status, expires_at);
create index medicine_requests_medicine_created_idx on public.medicine_requests (medicine_id, created_at desc);

create table public.medicine_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.medicine_requests (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  response text not null check (response in ('available', 'unavailable')),
  message text check (message is null or length(message) <= 1000),
  responded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, business_id)
);

create index medicine_request_responses_business_created_idx on public.medicine_request_responses (business_id, created_at desc);
create index medicine_request_responses_request_response_idx on public.medicine_request_responses (request_id, response);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references public.users (id) on delete set null,
  business_id uuid not null references public.businesses (id) on delete restrict,
  medicine_request_id uuid references public.medicine_requests (id) on delete set null,
  status text not null default 'inquiry' check (status in ('inquiry', 'pending_confirmation', 'confirmed', 'cancelled', 'completed')),
  customer_note text,
  partner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_business_status_created_idx on public.orders (business_id, status, created_at desc);
create index orders_customer_created_idx on public.orders (customer_user_id, created_at desc);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references public.users (id) on delete set null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  medicine_id uuid references public.medicines (id) on delete set null,
  message text not null check (length(trim(message)) between 1 and 2000),
  contact_preference text not null default 'in_app' check (contact_preference in ('in_app', 'call', 'whatsapp')),
  status text not null default 'open' check (status in ('open', 'responded', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inquiries_business_status_created_idx on public.inquiries (business_id, status, created_at desc);
create index inquiries_customer_created_idx on public.inquiries (customer_user_id, created_at desc);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  monthly_price_inr numeric(10, 2) not null default 0 check (monthly_price_inr >= 0),
  yearly_price_inr numeric(10, 2) not null default 0 check (yearly_price_inr >= 0),
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  team_member_limit integer check (team_member_limit is null or team_member_limit >= 0),
  inventory_limit integer check (inventory_limit is null or inventory_limit >= 0),
  trial_days integer not null default 0 check (trial_days >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly', 'custom')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create index subscriptions_business_status_idx on public.subscriptions (business_id, status);
create index subscriptions_expiry_idx on public.subscriptions (status, current_period_end);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null check (provider in ('razorpay', 'cashfree', 'manual')),
  provider_order_id text,
  provider_payment_id text,
  amount_inr numeric(12, 2) not null check (amount_inr >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded')),
  invoice_path text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index payments_business_status_created_idx on public.payments (business_id, status, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id, created_at desc);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  description text,
  promotion_type text not null check (promotion_type in ('offer', 'featured_listing', 'sponsored_listing')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'scheduled', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index promotions_business_status_idx on public.promotions (business_id, status, starts_at);
create index promotions_active_window_idx on public.promotions (status, starts_at, ends_at);

create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  title text not null,
  image_path text,
  destination_url text check (destination_url is null or destination_url ~ '^https://'),
  placement text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'scheduled', 'active', 'paused', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_inr numeric(12, 2) check (budget_inr is null or budget_inr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index advertisements_status_placement_idx on public.advertisements (status, placement, starts_at);
create index advertisements_business_idx on public.advertisements (business_id, status);

create table public.redirect_websites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website_url text not null check (website_url ~ '^https://'),
  logo_path text,
  description text,
  button_text text not null,
  display_position integer not null default 0 check (display_position >= 0),
  open_in_new_tab boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index redirect_websites_active_position_idx on public.redirect_websites (is_active, display_position);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  event_type text not null,
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null check (length(body) <= 2000),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_user_id uuid not null references public.users (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  review_text text check (review_text is null or length(review_text) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  reviewed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_user_id)
);

create index reviews_business_status_created_idx on public.reviews (business_id, status, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated by default as identity unique,
  requester_user_id uuid not null references public.users (id) on delete restrict,
  business_id uuid references public.businesses (id) on delete set null,
  assigned_to uuid references public.users (id) on delete set null,
  category text not null,
  subject text not null check (length(trim(subject)) between 1 and 200),
  description text not null check (length(trim(description)) between 1 and 5000),
  attachment_path text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_status_priority_created_idx on public.support_tickets (status, priority, created_at desc);
create index support_tickets_assigned_status_idx on public.support_tickets (assigned_to, status);
create index support_tickets_requester_created_idx on public.support_tickets (requester_user_id, created_at desc);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid not null references public.users (id) on delete restrict,
  message text not null check (length(trim(message)) between 1 and 5000),
  is_internal boolean not null default false,
  attachment_path text,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_created_idx on public.support_ticket_messages (ticket_id, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  role_slug text,
  action text not null,
  module text not null,
  record_table text,
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_module_action_created_idx on public.audit_logs (module, action, created_at desc);
create index audit_logs_record_idx on public.audit_logs (record_table, record_id, created_at desc);

create table public.security_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  recovery_email text,
  recovery_phone_e164 text,
  security_pin_hash text,
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  locked_until timestamptz,
  last_failed_attempt_at timestamptz,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'businesses', 'roles', 'business_team_members', 'compositions',
    'manufacturers', 'categories', 'medicines', 'inventory', 'inventory_visibility',
    'medicine_requests', 'medicine_request_responses', 'orders', 'inquiries',
    'subscription_plans', 'subscriptions', 'payments', 'promotions', 'advertisements',
    'redirect_websites', 'reviews', 'support_tickets', 'security_settings'
  ] loop
    execute pg_catalog.format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

insert into public.roles (slug, name, description, is_system) values
  ('customer', 'Customer', 'Medicine discovery and request access.', true),
  ('partner', 'Partner', 'Retail pharmacy, clinic pharmacy, or nursing home access.', true),
  ('distributor', 'Distributor', 'Private business-to-business distributor access.', true),
  ('team_member', 'Team Member', 'Access granted through a business or admin role.', true),
  ('super_admin', 'Super Admin', 'Full platform administration.', true),
  ('admin', 'Admin', 'Platform administration within assigned permissions.', true),
  ('medicine_manager', 'Medicine Manager', 'Medicine master data management.', true),
  ('partner_manager', 'Partner Manager', 'Partner onboarding and verification.', true),
  ('support_manager', 'Support Manager', 'Support ticket management.', true),
  ('finance_manager', 'Finance Manager', 'Plans, subscriptions, and payment operations.', true),
  ('content_manager', 'Content Manager', 'Public content and promotion management.', true)
on conflict (slug) where business_id is null do nothing;

insert into public.permissions (permission_key, module, action, description) values
  ('dashboard.view', 'dashboard', 'view', 'View authorized dashboard data.'),
  ('users.view', 'users', 'view', 'View user records.'),
  ('users.manage', 'users', 'manage', 'Create, update, suspend, or delete users.'),
  ('partners.view', 'partners', 'view', 'View partner businesses.'),
  ('partners.manage', 'partners', 'manage', 'Create or update partner businesses.'),
  ('partners.approve', 'partners', 'approve', 'Approve, reject, or suspend partner businesses.'),
  ('medicines.view', 'medicines', 'view', 'View the medicine master.'),
  ('medicines.manage', 'medicines', 'manage', 'Create or update medicine master records.'),
  ('medicines.approve', 'medicines', 'approve', 'Approve or reject medicine master records.'),
  ('inventory.view', 'inventory', 'view', 'View authorized business inventory.'),
  ('inventory.manage', 'inventory', 'manage', 'Add or update authorized business inventory.'),
  ('inventory.export', 'inventory', 'export', 'Export authorized inventory records.'),
  ('requests.view', 'requests', 'view', 'View authorized medicine requests.'),
  ('requests.respond', 'requests', 'respond', 'Respond to medicine requests.'),
  ('payments.view', 'payments', 'view', 'View authorized payment records.'),
  ('payments.manage', 'payments', 'manage', 'Manage payment and subscription records.'),
  ('promotions.manage', 'promotions', 'manage', 'Manage offers and sponsored listings.'),
  ('reports.view', 'reports', 'view', 'View authorized analytics and reports.'),
  ('reports.export', 'reports', 'export', 'Export authorized reports.'),
  ('support.manage', 'support', 'manage', 'Assign and manage support tickets.'),
  ('content.manage', 'content', 'manage', 'Manage public content and redirects.'),
  ('team.manage', 'team', 'manage', 'Manage team members and roles.'),
  ('settings.manage', 'settings', 'manage', 'Manage authorized application settings.'),
  ('security.manage', 'security', 'manage', 'Manage security controls and recovery settings.'),
  ('audit_logs.view', 'audit_logs', 'view', 'View security and administrative audit logs.')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles as roles
cross join public.permissions as permissions
where roles.slug = 'super_admin' and roles.business_id is null
on conflict do nothing;

-- Deny client access by default until phase-specific RLS policies are installed.
alter table public.users enable row level security;
alter table public.business_types enable row level security;
alter table public.states enable row level security;
alter table public.districts enable row level security;
alter table public.areas enable row level security;
alter table public.businesses enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.business_team_members enable row level security;
alter table public.compositions enable row level security;
alter table public.manufacturers enable row level security;
alter table public.categories enable row level security;
alter table public.medicines enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_visibility enable row level security;
alter table public.medicine_requests enable row level security;
alter table public.medicine_request_responses enable row level security;
alter table public.orders enable row level security;
alter table public.inquiries enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.promotions enable row level security;
alter table public.advertisements enable row level security;
alter table public.redirect_websites enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.security_settings enable row level security;
