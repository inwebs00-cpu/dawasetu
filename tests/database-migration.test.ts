// @vitest-environment node

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationPaths = [
  "supabase/migrations/20261008010000_dawasetu_core_schema.sql",
  "supabase/migrations/20261008020000_auth_rls_and_public_search.sql",
  "supabase/migrations/20261008030000_partner_inventory_workflows.sql",
  "supabase/migrations/20261008040000_customer_request_and_partner_profile.sql",
  "supabase/migrations/20261008050000_admin_medicine_master.sql",
  "supabase/migrations/20261008060000_partner_approval_and_area_admin.sql",
  "supabase/migrations/20261008070000_distributor_b2b_access.sql",
  "supabase/migrations/20261008080000_admin_business_creation.sql",
  "supabase/migrations/20261008090000_request_response_lifecycle.sql",
  "supabase/migrations/20261008100000_public_content_management.sql",
  "supabase/migrations/20261008110000_audit_business_inventory_changes.sql",
  "supabase/migrations/20261008120000_admin_support_workflows.sql",
  "supabase/migrations/20261008130000_admin_team_roles.sql",
  "supabase/migrations/20261008140000_customer_account_features.sql",
  "supabase/migrations/20261008150000_admin_subscription_plans.sql",
  "supabase/migrations/20261008160000_subscription_checkout_and_payments.sql",
  "supabase/migrations/20261008170000_payment_receipts_and_expiry.sql",
  "supabase/migrations/20261008180000_redirect_website_management.sql",
  "supabase/migrations/20261008190000_customer_support_conversations.sql",
  "supabase/migrations/20261008200000_public_medicine_alternatives.sql",
  "supabase/migrations/20261008210000_partner_promotions.sql",
  "supabase/migrations/20261008220000_support_team_assignment.sql",
  "supabase/migrations/20261008230000_business_reviews.sql",
  "supabase/migrations/20261008240000_partner_promotion_requests.sql",
  "supabase/migrations/20261008250000_private_support_attachments.sql",
  "supabase/migrations/20261008260000_admin_mfa_enforcement.sql",
  "supabase/migrations/20261008270000_partner_verification_documents.sql",
  "supabase/migrations/20261008280000_usage_analytics.sql",
  "supabase/migrations/20261008290000_batched_search_analytics.sql",
  "supabase/migrations/20261008300000_business_document_cleanup.sql",
  "supabase/migrations/20261008310000_notification_realtime.sql",
  "supabase/migrations/20261008320000_medicine_category_management.sql",
  "supabase/migrations/20261008330000_payment_refunds.sql",
  "supabase/migrations/20261008340000_security_recovery.sql",
  "supabase/migrations/20261008350000_doctor_booking_profiles.sql",
  "supabase/migrations/20261014010000_location_only_public_medicine_search.sql",
  "supabase/migrations/20261015010000_customer_partner_inquiries.sql",
  "supabase/migrations/20261015020000_admin_user_directory.sql",
  "supabase/migrations/20261015030000_distributor_inquiries.sql",
].map((path) => resolve(process.cwd(), path));

describe("DawaSetu core schema migration", () => {
  let database: PGlite;

  beforeAll(async () => {
    database = await PGlite.create();
    await database.exec(`
      create schema auth;
      create schema storage;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      create table storage.buckets (
        id text primary key,
        name text not null,
        public boolean not null default false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text not null references storage.buckets(id),
        name text not null,
        owner_id uuid
      );
      create table auth.users (
        id uuid primary key,
        raw_user_meta_data jsonb,
        email text,
        email_confirmed_at timestamptz default now(),
        phone text,
        phone_confirmed_at timestamptz,
        last_sign_in_at timestamptz
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;
      grant execute on function auth.uid() to anon, authenticated;
      grant execute on function auth.jwt() to anon, authenticated;
    `);
    for (const migrationPath of migrationPaths) {
      await database.exec(await readFile(migrationPath, "utf8"));
    }
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("creates the core tables with row-level security enabled", async () => {
    const tables = await database.query<{
      name: string;
      rls_enabled: boolean;
    }>(`
      select c.relname as name, c.relrowsecurity as rls_enabled
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname;
    `);
    const businessTypes = await database.query<{ count: number }>(
      "select count(*)::int as count from public.business_types",
    );
    const roles = await database.query<{ count: number }>(
      "select count(*)::int as count from public.roles",
    );

    expect(tables.rows.length).toBeGreaterThan(30);
    expect(tables.rows.every((table) => table.rls_enabled)).toBe(true);
    expect(businessTypes.rows[0].count).toBe(4);
    expect(roles.rows[0].count).toBeGreaterThan(0);
  });

  it("preserves inventory rows and rejects zero quantity as available", async () => {
    const userId = randomUUID();
    const businessId = randomUUID();
    const medicineId = randomUUID();
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );

    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [userId, { full_name: "Migration Check", account_type: "super_admin" }],
    );
    await database.query(
      `insert into public.businesses
        (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        businessId,
        userId,
        businessType.rows[0].id,
        "Local Pharmacy",
        "local-pharmacy",
        "+910000000000",
        "Main Road",
      ],
    );
    await database.query(
      `insert into public.medicines (id, product_name, strength, medicine_type)
       values ($1, $2, $3, $4)`,
      [medicineId, "Test Product", "500 mg", "tablet"],
    );

    await expect(
      database.query(
        `insert into public.inventory (business_id, medicine_id, status, quantity)
         values ($1, $2, 'available', 0)`,
        [businessId, medicineId],
      ),
    ).rejects.toThrow();

    const inventory = await database.query<{
      status: string;
      quantity: number;
    }>(
      `insert into public.inventory (business_id, medicine_id, status, quantity)
       values ($1, $2, 'out_of_stock', 0)
       returning status, quantity`,
      [businessId, medicineId],
    );

    expect(inventory.rows[0]).toEqual({ status: "out_of_stock", quantity: 0 });
    const inventoryAudit = await database.query<{ count: number }>(
      "select count(*)::int as count from public.audit_logs where record_table = 'inventory' and record_id = (select id from public.inventory where business_id = $1 and medicine_id = $2)",
      [businessId, medicineId],
    );
    expect(inventoryAudit.rows[0].count).toBe(1);
  });

  it("bootstraps new auth users with customer access only", async () => {
    const userId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [
        userId,
        {
          full_name: "New Customer",
          account_type: "super_admin",
          role: "admin",
        },
      ],
    );

    const profile = await database.query<{
      account_type: string;
      full_name: string;
    }>("select account_type, full_name from public.users where id = $1", [
      userId,
    ]);
    const role = await database.query<{ slug: string }>(
      `select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1`,
      [userId],
    );

    expect(profile.rows[0]).toEqual({
      account_type: "customer",
      full_name: "New Customer",
    });
    expect(role.rows.map((row) => row.slug)).toEqual(["customer"]);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [userId],
    );
    const ownProfile = await database.query<{ count: number }>(
      "select count(*)::int as count from public.users where id = $1",
      [userId],
    );
    const otherProfiles = await database.query<{ count: number }>(
      "select count(*)::int as count from public.users where id <> auth.uid()",
    );
    await expect(
      database.query(
        "update public.users set account_type = 'admin' where id = $1",
        [userId],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");

    expect(ownProfile.rows[0].count).toBe(1);
    expect(otherProfiles.rows[0].count).toBe(0);
  });

  it("exposes only active non-distributor availability through the public search RPC", async () => {
    const ownerId = randomUUID();
    const retailId = randomUUID();
    const distributorId = randomUUID();
    const medicineId = randomUUID();
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [ownerId, { full_name: "Partner Owner" }],
    );
    const composition = await database.query<{ id: string }>(
      `insert into public.compositions (name, status) values ('Paracetamol', 'approved') returning id`,
    );
    const manufacturer = await database.query<{ id: string }>(
      `insert into public.manufacturers (name, status) values ('Example Labs', 'approved') returning id`,
    );
    await database.query(
      `insert into public.medicines (id, product_name, brand_name, composition_id, strength, manufacturer_id, medicine_type, status, reviewed_at)
       values ($1, 'Paracetamol 500', 'Para 500', $2, '500 mg', $3, 'tablet', 'approved', now())`,
      [medicineId, composition.rows[0].id, manufacturer.rows[0].id],
    );
    for (const [businessId, typeId, name, slug] of [
      [retailId, retailType.rows[0].id, "Public Pharmacy", "public-pharmacy"],
      [
        distributorId,
        distributorType.rows[0].id,
        "Private Stockist",
        "private-stockist",
      ],
    ]) {
      await database.query(
        `insert into public.businesses (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, public_availability_enabled, status, reviewed_at)
         values ($1, $2, $3, $4, $5, '+910000000000', 'Main Road', true, 'approved', now())`,
        [businessId, ownerId, typeId, name, slug],
      );
      const inventory = await database.query<{ id: string }>(
        `insert into public.inventory (business_id, medicine_id, status) values ($1, $2, 'available') returning id`,
        [businessId, medicineId],
      );
      await database.query(
        `insert into public.inventory_visibility (inventory_id, public_visible) values ($1, true)`,
        [inventory.rows[0].id],
      );
    }

    await database.query(
      "update public.businesses set latitude = 19.076, longitude = 72.8777 where id = $1",
      [retailId],
    );

    await database.exec("set role anon");
    const results = await database.query<{ business_name: string }>(
      "select business_name from public.search_public_medicine('paracetamol')",
    );
    const directory = await database.query<{ business_name: string }>(
      "select business_name from public.list_public_businesses()",
    );
    const nearbyResults = await database.query<{
      business_name: string;
      distance_km: number;
    }>(
      "select business_name, distance_km from public.search_public_medicine('', 19.076, 72.8777)",
    );
    const distributorProfile = await database.query<{ business_id: string }>(
      "select business_id from public.get_public_business_profile('private-stockist')",
    );
    const distributorMedicines = await database.query<{ medicine_id: string }>(
      "select medicine_id from public.list_public_business_medicines('private-stockist')",
    );
    await expect(
      database.query("select count(*) from public.inventory"),
    ).rejects.toThrow();
    await database.exec("reset role");

    expect(results.rows.map((row) => row.business_name)).toEqual([
      "Public Pharmacy",
    ]);
    expect(nearbyResults.rows).toHaveLength(1);
    expect(nearbyResults.rows[0].business_name).toBe("Public Pharmacy");
    expect(nearbyResults.rows[0].distance_km).toBeCloseTo(0, 6);
    expect(directory.rows.map((row) => row.business_name)).toEqual([
      "Public Pharmacy",
    ]);
    expect(distributorProfile.rows).toHaveLength(0);
    expect(distributorMedicines.rows).toHaveLength(0);

    const customerId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [customerId, { full_name: "Unrelated Customer" }],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const privateInventory = await database.query<{ count: number }>(
      "select count(*)::int as count from public.inventory",
    );
    await database.exec("reset role");
    expect(privateInventory.rows[0].count).toBe(0);
  });

  it("keeps partner medicine submissions pending and permission checked", async () => {
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    const businessId = randomUUID();
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        ownerId,
        { full_name: "Partner Submitter" },
        otherUserId,
        { full_name: "Unrelated Customer" },
      ],
    );
    await database.query(
      `insert into public.businesses (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, $3, 'Pending Pharmacy', $4, '+910000000001', 'Market Road')`,
      [
        businessId,
        ownerId,
        businessType.rows[0].id,
        `pending-${businessId.slice(0, 8)}`,
      ],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    const submitted = await database.query<{ medicine_id: string }>(
      `select public.submit_partner_medicine($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as medicine_id`,
      [
        businessId,
        "DawaSetu Test Product",
        "DawaSetu Brand",
        "Example compound",
        "10 mg",
        "DawaSetu Test Labs",
        "tablet",
        "prescription",
        "10 tablets",
        null,
      ],
    );
    const visiblePending = await database.query<{ count: number }>(
      "select count(*)::int as count from public.search_medicine_master('DawaSetu Test Product')",
    );
    await database.exec("reset role");

    const medicine = await database.query<{
      status: string;
      submitted_by: string;
    }>("select status, submitted_by from public.medicines where id = $1", [
      submitted.rows[0].medicine_id,
    ]);
    expect(medicine.rows[0]).toEqual({
      status: "pending",
      submitted_by: ownerId,
    });
    expect(visiblePending.rows[0].count).toBe(1);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherUserId],
    );
    await expect(
      database.query(
        `select public.submit_partner_medicine($1, 'Unauthorized Product', null, 'Example compound', '10 mg', 'Other Labs', 'tablet', 'prescription', null, null)`,
        [businessId],
      ),
    ).rejects.toThrow();
    const hiddenPending = await database.query<{ count: number }>(
      "select count(*)::int as count from public.search_medicine_master('DawaSetu Test Product')",
    );
    await database.exec("reset role");
    expect(hiddenPending.rows[0].count).toBe(0);
  });

  it("routes only area-matched medicine requests and notifies the customer", async () => {
    const customerId = randomUUID();
    const partnerId = randomUUID();
    const businessId = randomUUID();
    const medicineId = randomUUID();
    const state = await database.query<{ id: string }>(
      `insert into public.states (name, code) values ('DawaSetu Test State', 'DT') returning id`,
    );
    const district = await database.query<{ id: string }>(
      `insert into public.districts (state_id, name) values ($1, 'Test District') returning id`,
      [state.rows[0].id],
    );
    const area = await database.query<{ id: string }>(
      `insert into public.areas (district_id, name, postal_code) values ($1, 'Test Area', '000001') returning id`,
      [district.rows[0].id],
    );
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        customerId,
        { full_name: "Requesting Customer" },
        partnerId,
        { full_name: "Local Partner" },
      ],
    );
    const composition = await database.query<{ id: string }>(
      `insert into public.compositions (name) values ('Test composition') returning id`,
    );
    const manufacturer = await database.query<{ id: string }>(
      `insert into public.manufacturers (name) values ('Test Manufacturer') returning id`,
    );
    await database.query(
      `insert into public.medicines (id, product_name, composition_id, strength, manufacturer_id, medicine_type, status, reviewed_at)
       values ($1, 'Requested Test Medicine', $2, '5 mg', $3, 'tablet', 'approved', now())`,
      [medicineId, composition.rows[0].id, manufacturer.rows[0].id],
    );
    await database.query(
      `insert into public.businesses (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, area_id, public_availability_enabled, status, reviewed_at)
       values ($1, $2, $3, 'Request Pharmacy', $4, '+910000000002', 'Main Road', $5, true, 'approved', now())`,
      [
        businessId,
        partnerId,
        businessType.rows[0].id,
        `request-${businessId.slice(0, 8)}`,
        area.rows[0].id,
      ],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const request = await database.query<{ id: string }>(
      `select public.create_medicine_request($1, $2, $3, $4, $5, $6, $7, $8, $9) as id`,
      [
        medicineId,
        "Requested Test Medicine",
        "Test composition",
        "5 mg",
        2,
        area.rows[0].id,
        "Please confirm",
        "in_app",
        null,
      ],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [partnerId],
    );
    const nearbyRequests = await database.query<{
      request_id: string;
      approximate_area: string;
    }>(
      "select request_id, approximate_area from public.list_business_medicine_requests($1)",
      [businessId],
    );
    const response = await database.query<{ response_id: string }>(
      `select public.respond_to_medicine_request($1, $2, 'available', null) as response_id`,
      [businessId, request.rows[0].id],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const notifications = await database.query<{ count: number }>(
      `select count(*)::int as count from public.notifications where user_id = $1 and event_type = 'medicine_request_response'`,
      [customerId],
    );
    const customerRequest = await database.query<{
      business_name: string | null;
      request_id: string;
      status: string;
    }>(
      "select request_id, business_name, status from public.list_my_medicine_requests()",
    );
    await database.exec("reset role");

    expect(nearbyRequests.rows).toEqual([
      { request_id: request.rows[0].id, approximate_area: "Test Area" },
    ]);
    expect(notifications.rows[0].count).toBe(1);
    expect(customerRequest.rows).toEqual([
      {
        request_id: request.rows[0].id,
        business_name: "Request Pharmacy",
        status: "partially_fulfilled",
      },
    ]);
    expect(response.rows[0].response_id).toBeTruthy();
  });

  it("requires medicine permissions, audits admin edits, and keeps approval explicit", async () => {
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [adminId, { full_name: "Medicine Manager" }],
    );
    const medicineManagerRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'medicine_manager' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles (user_id, role_id) values ($1, $2)",
      [adminId, medicineManagerRole.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const category = await database.query<{ id: string }>(
      "select id from public.categories where slug = 'pain-relief'",
    );
    const saved = await database.query<{ medicine_id: string }>(
      `select public.admin_save_medicine(null, 'Admin Test Product', 'Admin Test Brand', 'Example ingredient', '25 mg', 'Admin Example Labs', $1, 'tablet', 'otc', '10 tablets', true) as medicine_id`,
      [category.rows[0].id],
    );
    const pending = await database.query<{ medicine_status: string }>(
      "select medicine_status from public.admin_list_medicines('Admin Test Product', 'pending', 50, 0)",
    );
    await database.query(
      "select public.admin_review_medicine($1, 'approved', 'Verified against source documentation')",
      [saved.rows[0].medicine_id],
    );
    await database.exec("reset role");

    const medicine = await database.query<{
      status: string;
      reviewed_by: string;
    }>("select status, reviewed_by from public.medicines where id = $1", [
      saved.rows[0].medicine_id,
    ]);
    const audit = await database.query<{ count: number }>(
      "select count(*)::int as count from public.audit_logs where record_table = 'medicines' and record_id = $1",
      [saved.rows[0].medicine_id],
    );
    expect(pending.rows).toEqual([{ medicine_status: "pending" }]);
    expect(medicine.rows[0]).toEqual({
      status: "approved",
      reviewed_by: adminId,
    });
    expect(audit.rows[0].count).toBe(2);
  });

  it("approves partners and creates routable areas only for authorized administrators", async () => {
    const adminId = randomUUID();
    const ownerId = randomUUID();
    const businessId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        adminId,
        { full_name: "Partner Manager" },
        ownerId,
        { full_name: "Business Owner" },
      ],
    );
    const managerRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'partner_manager' and business_id is null",
    );
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      "insert into public.user_roles (user_id, role_id) values ($1, $2)",
      [adminId, managerRole.rows[0].id],
    );
    await database.query(
      `insert into public.businesses (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, $3, 'Review Pharmacy', $4, '+910000000003', 'High Street')`,
      [
        businessId,
        ownerId,
        businessType.rows[0].id,
        `review-${businessId.slice(0, 8)}`,
      ],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const pending = await database.query<{
      business_id: string;
      business_status: string;
    }>(
      "select business_id, business_status from public.admin_list_businesses('pending', null, 50, 0) where business_id = $1",
      [businessId],
    );
    await database.query(
      "select public.admin_review_business($1, 'approved', 'Licence verified')",
      [businessId],
    );
    const area = await database.query<{ area_id: string }>(
      "select public.admin_save_area('Maharashtra', 'MH', 'Pune', 'Kothrud', '411038') as area_id",
    );
    await database.exec("reset role");

    const reviewed = await database.query<{
      status: string;
      public_availability_enabled: boolean;
    }>(
      "select status, public_availability_enabled from public.businesses where id = $1",
      [businessId],
    );
    const savedArea = await database.query<{
      name: string;
      postal_code: string;
    }>("select name, postal_code from public.areas where id = $1", [
      area.rows[0].area_id,
    ]);
    expect(pending.rows).toEqual([
      { business_id: businessId, business_status: "pending" },
    ]);
    expect(reviewed.rows[0]).toEqual({
      status: "approved",
      public_availability_enabled: false,
    });
    expect(savedArea.rows[0]).toEqual({
      name: "Kothrud",
      postal_code: "411038",
    });
  });

  it("keeps distributor inventory private until a verified partner is approved", async () => {
    const partnerId = randomUUID();
    const distributorId = randomUUID();
    const partnerBusinessId = randomUUID();
    const distributorBusinessId = randomUUID();
    const medicineId = randomUUID();
    const partnerType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        partnerId,
        { full_name: "Verified Pharmacy" },
        distributorId,
        { full_name: "Verified Stockist" },
      ],
    );
    await database.query(
      `insert into public.businesses (id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, public_availability_enabled, status, reviewed_at)
       values ($1, $2, $3, 'B2B Pharmacy', $4, '+910000000004', 'Market Road', true, 'approved', now()),
              ($5, $6, $7, 'Private Stockist', $8, '+910000000005', 'Warehouse Road', true, 'approved', now())`,
      [
        partnerBusinessId,
        partnerId,
        partnerType.rows[0].id,
        `b2b-pharmacy-${partnerBusinessId.slice(0, 6)}`,
        distributorBusinessId,
        distributorId,
        distributorType.rows[0].id,
        `b2b-stockist-${distributorBusinessId.slice(0, 6)}`,
      ],
    );
    const composition = await database.query<{ id: string }>(
      "insert into public.compositions (name, status) values ('B2B composition', 'approved') returning id",
    );
    const manufacturer = await database.query<{ id: string }>(
      "insert into public.manufacturers (name, status) values ('B2B Manufacturer', 'approved') returning id",
    );
    await database.query(
      `insert into public.medicines (id, product_name, composition_id, strength, manufacturer_id, medicine_type, status, reviewed_at)
       values ($1, 'Private B2B Product', $2, '20 mg', $3, 'tablet', 'approved', now())`,
      [medicineId, composition.rows[0].id, manufacturer.rows[0].id],
    );
    await database.query(
      "insert into public.inventory (business_id, medicine_id, status, quantity) values ($1, $2, 'available', 17)",
      [distributorBusinessId, medicineId],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [partnerId],
    );
    await expect(
      database.query(
        "select * from public.list_distributor_inventory_for_partner($1, $2, null)",
        [partnerBusinessId, distributorBusinessId],
      ),
    ).rejects.toThrow();
    await database.query("select public.request_distributor_access($1, $2)", [
      partnerBusinessId,
      distributorBusinessId,
    ]);
    await expect(
      database.query(
        `select public.create_partner_distributor_inquiry($1, $2, $3, 8, 'Please confirm this stock')`,
        [partnerBusinessId, distributorBusinessId, medicineId],
      ),
    ).rejects.toThrow(/access is not approved/i);
    const rawStockBeforeApproval = await database.query<{ count: number }>(
      "select count(*)::int as count from public.inventory where business_id = $1",
      [distributorBusinessId],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [distributorId],
    );
    await database.query(
      "select public.review_distributor_access($1, $2, 'approved', null)",
      [distributorBusinessId, partnerBusinessId],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [partnerId],
    );
    const authorizedStock = await database.query<{
      product_name: string;
      quantity: number;
    }>(
      "select product_name, quantity from public.list_distributor_inventory_for_partner($1, $2, 'private b2b')",
      [partnerBusinessId, distributorBusinessId],
    );
    const inquiry = await database.query<{ inquiry_id: string }>(
      `select public.create_partner_distributor_inquiry($1, $2, $3, 8, 'Please confirm this stock') as inquiry_id`,
      [partnerBusinessId, distributorBusinessId, medicineId],
    );
    const partnerInquiry = await database.query<{
      product_name: string;
      status: string;
      requested_quantity: number;
    }>(
      `select product_name, status, requested_quantity
       from public.list_my_partner_distributor_inquiries($1)`,
      [partnerBusinessId],
    );
    await expect(
      database.query("select * from public.distributor_inquiries"),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [distributorId],
    );
    const distributorInquiries = await database.query<{
      partner_name: string;
      product_name: string;
      requested_quantity: number;
      status: string;
    }>(
      `select partner_name, product_name, requested_quantity, status
       from public.list_my_distributor_inquiries($1, 'open')`,
      [distributorBusinessId],
    );
    await database.query(
      `select public.respond_to_distributor_inquiry($1, $2, 'responded', 'Eight packs reported available')`,
      [distributorBusinessId, inquiry.rows[0].inquiry_id],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [partnerId],
    );
    const updatedPartnerInquiry = await database.query<{
      status: string;
      response_message: string;
    }>(
      `select status, response_message
       from public.list_my_partner_distributor_inquiries($1)`,
      [partnerBusinessId],
    );
    await database.exec("reset role");

    const distributor = await database.query<{
      public_availability_enabled: boolean;
    }>(
      "select public_availability_enabled from public.businesses where id = $1",
      [distributorBusinessId],
    );
    await database.exec("set role anon");
    const publicSearch = await database.query<{ business_name: string }>(
      "select business_name from public.search_public_medicine('Private B2B Product')",
    );
    await database.exec("reset role");
    expect(rawStockBeforeApproval.rows[0].count).toBe(0);
    expect(authorizedStock.rows).toEqual([
      { product_name: "Private B2B Product", quantity: 17 },
    ]);
    expect(partnerInquiry.rows).toEqual([
      {
        product_name: "Private B2B Product",
        status: "open",
        requested_quantity: 8,
      },
    ]);
    expect(distributorInquiries.rows).toEqual([
      {
        partner_name: "B2B Pharmacy",
        product_name: "Private B2B Product",
        requested_quantity: 8,
        status: "open",
      },
    ]);
    expect(updatedPartnerInquiry.rows).toEqual([
      {
        status: "responded",
        response_message: "Eight packs reported available",
      },
    ]);
    expect(distributor.rows[0].public_availability_enabled).toBe(false);
    expect(publicSearch.rows).toHaveLength(0);
  });

  it("lets partner managers onboard a distributor for review without enabling public visibility", async () => {
    const adminId = randomUUID();
    const ownerId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data, email) values ($1, $2, $3), ($4, $5, $6)",
      [
        adminId,
        { full_name: "Business Manager" },
        "manager@example.in",
        ownerId,
        { full_name: "Stockist Owner" },
        "stockist@example.in",
      ],
    );
    const managerRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'partner_manager' and business_id is null",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    await database.query(
      "insert into public.user_roles (user_id, role_id) values ($1, $2)",
      [adminId, managerRole.rows[0].id],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const created = await database.query<{ business_id: string }>(
      `select public.admin_create_business(
        'stockist@example.in', $1, 'New Test Stockist', null, '+910000000006', null,
        'stockist@example.in', 'Warehouse address', null, null, null, null, null, null
      ) as business_id`,
      [distributorType.rows[0].id],
    );
    await database.exec("reset role");
    const business = await database.query<{
      status: string;
      public_availability_enabled: boolean;
      is_distributor: boolean;
    }>(
      `select b.status, b.public_availability_enabled, bt.is_distributor
       from public.businesses b join public.business_types bt on bt.id = b.business_type_id where b.id = $1`,
      [created.rows[0].business_id],
    );
    const owner = await database.query<{ account_type: string }>(
      "select account_type from public.users where id = $1",
      [ownerId],
    );
    expect(business.rows[0]).toEqual({
      status: "pending",
      public_availability_enabled: false,
      is_distributor: true,
    });
    expect(owner.rows[0].account_type).toBe("distributor");
  });

  it("publishes only approved content and keeps content editing permission checked", async () => {
    const editorId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2)",
      [editorId, { full_name: "Content Editor" }],
    );
    const contentRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'content_manager' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [editorId, contentRole.rows[0].id],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [editorId],
    );
    await database.query(
      `select public.admin_save_content_post(null, 'network-update', 'Network update', 'A published update', 'Public information from DawaSetu.', null, null, 'published')`,
    );
    await database.query(
      `select public.admin_save_content_post(null, 'internal-draft', 'Internal draft', 'Draft summary', 'This must not be public.', null, null, 'draft')`,
    );
    await database.exec("reset role");

    await database.exec("set role anon");
    const publicPosts = await database.query<{ slug: string }>(
      "select slug from public.content_posts order by slug",
    );
    await expect(
      database.query(
        "select public.admin_save_content_post(null, 'no-access', 'No access', 'No access summary', 'No access body', null, null, 'published')",
      ),
    ).rejects.toThrow();
    await database.exec("reset role");
    expect(publicPosts.rows).toEqual([{ slug: "network-update" }]);
  });

  it("lets support staff triage tickets while keeping internal notes private", async () => {
    const customerId = randomUUID();
    const agentId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        customerId,
        { full_name: "Support Customer" },
        agentId,
        { full_name: "Support Agent" },
      ],
    );
    const role = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'support_manager' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [agentId, role.rows[0].id],
    );
    const ticket = await database.query<{ id: string; ticket_number: number }>(
      `insert into public.support_tickets(requester_user_id, category, subject, description)
       values ($1, 'account', 'Sign-in issue', 'The customer cannot sign in to their account.') returning id, ticket_number`,
      [customerId],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [agentId],
    );
    const number = await database.query<{
      admin_update_support_ticket: number;
    }>(
      `select public.admin_update_support_ticket($1, 'in_progress', 'high', 'Checking the account settings.', true, true)`,
      [ticket.rows[0].id],
    );
    const listed = await database.query<{
      status: string;
      priority: string;
      assigned_name: string;
      messages: { is_internal: boolean; message: string }[];
    }>(
      "select status, priority, assigned_name, messages from public.admin_list_support_tickets(null, 50, 0) where ticket_id = $1",
      [ticket.rows[0].id],
    );
    const assignees = await database.query<{
      user_id: string;
      full_name: string;
    }>("select user_id, full_name from public.admin_list_support_assignees()");
    await database.query(
      "select public.admin_assign_support_ticket($1, null)",
      [ticket.rows[0].id],
    );
    const assigned = await database.query<{
      admin_assign_support_ticket: number;
    }>("select public.admin_assign_support_ticket($1, $2)", [
      ticket.rows[0].id,
      agentId,
    ]);
    await expect(
      database.query("select public.admin_assign_support_ticket($1, $2)", [
        ticket.rows[0].id,
        customerId,
      ]),
    ).rejects.toThrow(/support team member/i);
    await database.exec("reset role");

    expect(number.rows[0].admin_update_support_ticket).toBe(
      ticket.rows[0].ticket_number,
    );
    expect(listed.rows[0]).toMatchObject({
      status: "in_progress",
      priority: "high",
      assigned_name: "Support Agent",
      messages: [
        { is_internal: true, message: "Checking the account settings." },
      ],
    });
    expect(assignees.rows).toEqual([
      { user_id: agentId, full_name: "Support Agent" },
    ]);
    expect(assigned.rows[0].admin_assign_support_ticket).toBe(
      ticket.rows[0].ticket_number,
    );
    const assignedNotification = await database.query<{ count: number }>(
      "select count(*)::int as count from public.notifications where user_id = $1 and event_type = 'support_ticket_assigned'",
      [agentId],
    );
    expect(assignedNotification.rows[0].count).toBe(1);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const customerMessages = await database.query<{ message: string }>(
      "select message from public.support_ticket_messages where ticket_id = $1",
      [ticket.rows[0].id],
    );
    await expect(
      database.query(
        "select public.admin_update_support_ticket($1, 'closed', 'normal', null, false, false)",
        [ticket.rows[0].id],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");
    expect(customerMessages.rows).toEqual([]);
  });

  it("lets ticket owners reply, reopens waiting tickets and blocks replies after closure", async () => {
    const customerId = randomUUID();
    const agentId = randomUUID();
    await database.query(
      "insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)",
      [
        customerId,
        { full_name: "Conversation Customer" },
        agentId,
        { full_name: "Conversation Agent" },
      ],
    );
    const role = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'support_manager' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [agentId, role.rows[0].id],
    );
    const ticket = await database.query<{ id: string }>(
      `insert into public.support_tickets(requester_user_id, assigned_to, category, subject, description, status)
       values ($1, $2, 'account', 'Account question', 'A customer needs help with an account setting.', 'waiting')
       returning id`,
      [customerId, agentId],
    );
    await database.query(
      `insert into public.support_ticket_messages(ticket_id, author_user_id, message, is_internal)
       values ($1, $2, 'Internal note that remains private.', true)`,
      [ticket.rows[0].id, agentId],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await database.query(
      "select public.add_my_support_ticket_message($1, 'I tried that step and still need help.')",
      [ticket.rows[0].id],
    );
    const customerView = await database.query<{
      status: string;
      messages: { message: string; is_internal: boolean }[];
    }>(
      `select st.status, coalesce(json_agg(json_build_object('message', stm.message, 'is_internal', stm.is_internal)
        order by stm.created_at) filter (where stm.id is not null), '[]'::json) as messages
       from public.support_tickets st
       left join public.support_ticket_messages stm on stm.ticket_id = st.id
       where st.id = $1 group by st.id`,
      [ticket.rows[0].id],
    );
    await expect(
      database.query(
        "select public.add_my_support_ticket_message($1, 'Another reply.')",
        [randomUUID()],
      ),
    ).rejects.toThrow(/not found/i);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [agentId],
    );
    await database.query(
      `select public.admin_update_support_ticket($1, 'closed', 'normal', null, false, false)`,
      [ticket.rows[0].id],
    );
    await database.exec("reset role");
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await expect(
      database.query(
        "select public.add_my_support_ticket_message($1, 'Reply after closure.')",
        [ticket.rows[0].id],
      ),
    ).rejects.toThrow(/closed/i);
    await database.exec("reset role");

    expect(customerView.rows[0]).toEqual({
      status: "open",
      messages: [
        {
          message: "I tried that step and still need help.",
          is_internal: false,
        },
      ],
    });
    const notification = await database.query<{ count: number }>(
      "select count(*)::int as count from public.notifications where user_id = $1 and event_type = 'support_ticket_reply'",
      [agentId],
    );
    expect(notification.rows[0].count).toBe(1);
  });

  it("permission-checks platform team and custom role administration", async () => {
    const adminId = randomUUID();
    const staffId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'team-admin@example.in', $2), ($3, 'team-staff@example.in', $4)",
      [
        adminId,
        { full_name: "Team Administrator" },
        staffId,
        { full_name: "Team Staff" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const savedRole = await database.query<{
      admin_save_platform_role: string;
    }>(
      `select public.admin_save_platform_role(null, 'report_viewer', 'Report Viewer', 'Read-only reporting role', array['reports.view'])`,
    );
    await database.query(
      "select public.admin_assign_platform_role('team-staff@example.in', $1)",
      [savedRole.rows[0].admin_save_platform_role],
    );
    const members = await database.query<{
      full_name: string;
      email: string;
      role_slug: string;
      user_status: string;
    }>(
      "select full_name, email, role_slug, user_status from public.admin_list_platform_team_members() where user_id = $1",
      [staffId],
    );
    await database.query(
      "select public.admin_set_platform_team_status($1, 'suspended')",
      [staffId],
    );
    await database.query(
      "select public.admin_set_platform_team_status($1, 'active')",
      [staffId],
    );
    await database.query("select public.admin_remove_platform_role($1, $2)", [
      staffId,
      savedRole.rows[0].admin_save_platform_role,
    ]);
    await database.exec("reset role");

    expect(members.rows).toEqual([
      {
        full_name: "Team Staff",
        email: "team-staff@example.in",
        role_slug: "report_viewer",
        user_status: "active",
      },
    ]);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [staffId],
    );
    await expect(
      database.query(
        "select public.admin_assign_platform_role('team-admin@example.in', $1)",
        [savedRole.rows[0].admin_save_platform_role],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");
  });

  it("keeps saved medicines, recent searches, and notifications scoped to each customer", async () => {
    const customerId = randomUUID();
    const otherCustomerId = randomUUID();
    const medicineId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'customer-one@example.in', $2), ($3, 'customer-two@example.in', $4)",
      [
        customerId,
        { full_name: "Customer One" },
        otherCustomerId,
        { full_name: "Customer Two" },
      ],
    );
    const composition = await database.query<{ id: string }>(
      "insert into public.compositions(name) values ('Saved test ingredient') returning id",
    );
    await database.query(
      `insert into public.medicines(id, product_name, composition_id, strength, medicine_type, status, reviewed_at)
       values ($1, 'Saved Test Medicine', $2, '10 mg', 'tablet', 'approved', now())`,
      [medicineId, composition.rows[0].id],
    );
    await database.query(
      "insert into public.notifications(user_id, event_type, title, body) values ($1, 'test', 'One notice', 'Customer one notification'), ($2, 'test', 'Other notice', 'Customer two notification')",
      [customerId, otherCustomerId],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await database.query("select public.save_my_medicine($1)", [medicineId]);
    await database.query(
      "select public.record_my_medicine_search(' Metformin   XR ')",
    );
    await database.query(
      "select public.record_my_medicine_search('metformin xr')",
    );
    const saved = await database.query<{ product_name: string }>(
      "select product_name from public.list_my_saved_medicines()",
    );
    const searches = await database.query<{
      query_text: string;
      search_count: number;
    }>(
      "select query_text, search_count from public.list_my_recent_medicine_searches(10)",
    );
    const marked = await database.query<{ mark_my_notifications_read: number }>(
      "select public.mark_my_notifications_read()",
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherCustomerId],
    );
    const otherSaved = await database.query<{ count: number }>(
      "select count(*)::int as count from public.saved_medicines",
    );
    const otherNotification = await database.query<{ read_at: string | null }>(
      "select read_at from public.notifications where user_id = $1",
      [otherCustomerId],
    );
    await expect(
      database.query("select public.save_my_medicine($1)", [randomUUID()]),
    ).rejects.toThrow();
    await database.exec("reset role");

    expect(saved.rows).toEqual([{ product_name: "Saved Test Medicine" }]);
    expect(searches.rows).toEqual([
      { query_text: "metformin xr", search_count: 2 },
    ]);
    expect(marked.rows[0].mark_my_notifications_read).toBe(1);
    expect(otherSaved.rows[0].count).toBe(0);
    expect(otherNotification.rows[0].read_at).toBeNull();
  });

  it("allows finance staff to manage editable plans and protects subscription history", async () => {
    const financeId = randomUUID();
    const ownerId = randomUUID();
    const businessId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'finance@example.in', $2), ($3, 'plan-owner@example.in', $4)",
      [
        financeId,
        { full_name: "Finance Manager" },
        ownerId,
        { full_name: "Plan Owner" },
      ],
    );
    const financeRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'finance_manager' and business_id is null",
    );
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [financeId, financeRole.rows[0].id],
    );
    await database.query(
      `insert into public.businesses(id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, $3, 'Plan Pharmacy', $4, '+910000000007', 'Main Road')`,
      [
        businessId,
        ownerId,
        businessType.rows[0].id,
        `plan-${businessId.slice(0, 8)}`,
      ],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [financeId],
    );
    const saved = await database.query<{
      admin_save_subscription_plan: string;
    }>(
      `select public.admin_save_subscription_plan(null, 'Starter Test', 'starter-test', 'Editable starter plan', 199, 1990, 2, 100, 7, array['medicine_requests', 'analytics'], true, 1)`,
    );
    const listed = await database.query<{
      monthly_price_inr: number;
      is_active: boolean;
      features: Record<string, boolean>;
    }>(
      "select monthly_price_inr, is_active, features from public.admin_list_subscription_plans() where plan_id = $1",
      [saved.rows[0].admin_save_subscription_plan],
    );
    await database.exec("reset role");
    await database.query(
      `insert into public.subscriptions(business_id, plan_id, status, billing_interval)
       values ($1, $2, 'active', 'monthly')`,
      [businessId, saved.rows[0].admin_save_subscription_plan],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [financeId],
    );
    await expect(
      database.query("select public.admin_delete_subscription_plan($1)", [
        saved.rows[0].admin_save_subscription_plan,
      ]),
    ).rejects.toThrow(/subscription history/i);
    await database.exec("reset role");

    expect(listed.rows[0]).toMatchObject({
      monthly_price_inr: "199.00",
      is_active: true,
      features: { medicine_requests: true, analytics: true },
    });
  });

  it("ties subscription order amounts to plans and settles captured payments idempotently", async () => {
    const ownerId = randomUUID();
    const otherId = randomUUID();
    const businessId = randomUUID();
    const planId = randomUUID();
    await database.query(
      "insert into auth.users(id, email, raw_user_meta_data) values ($1, 'checkout-owner@example.in', $2), ($3, 'checkout-other@example.in', $4)",
      [
        ownerId,
        { full_name: "Checkout Owner" },
        otherId,
        { full_name: "Other User" },
      ],
    );
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      `insert into public.businesses(id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, $3, 'Checkout Pharmacy', $4, '+910000000008', 'Main Road', 'approved', now())`,
      [
        businessId,
        ownerId,
        businessType.rows[0].id,
        `checkout-${businessId.slice(0, 8)}`,
      ],
    );
    await database.query(
      `insert into public.subscription_plans(id, name, slug, monthly_price_inr, yearly_price_inr, is_active)
       values ($1, 'Checkout Plan', $2, 199, 1990, true)`,
      [planId, `checkout-${planId.slice(0, 8)}`],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    const quote = await database.query<{ amount_paise: number }>(
      "select amount_paise from public.get_my_subscription_purchase_quote($1, $2, 'monthly')",
      [businessId, planId],
    );
    await expect(
      database.query(
        "select public.create_my_subscription_payment_order($1, $2, 'monthly', 'order_invalidamount', 100)",
        [businessId, planId],
      ),
    ).rejects.toThrow(/amount/i);
    await database.query(
      "select public.create_my_subscription_payment_order($1, $2, 'monthly', 'order_checkout123', $3)",
      [businessId, planId, quote.rows[0].amount_paise],
    );
    const order = await database.query<{ amount_paise: number }>(
      "select amount_paise from public.get_my_razorpay_order('order_checkout123')",
    );
    await database.exec("reset role");

    await database.exec("set role service_role");
    const captured = await database.query<{
      service_process_razorpay_payment_event: string;
    }>(
      `select public.service_process_razorpay_payment_event('event-checkout-1', 'order_checkout123', 'pay_checkout123', $1, 'INR', 'payment.captured')`,
      [order.rows[0].amount_paise],
    );
    const duplicate = await database.query<{
      service_process_razorpay_payment_event: string;
    }>(
      `select public.service_process_razorpay_payment_event('event-checkout-1', 'order_checkout123', 'pay_checkout123', $1, 'INR', 'payment.captured')`,
      [order.rows[0].amount_paise],
    );
    await database.exec("reset role");

    const paid = await database.query<{
      payment_id: string;
      payment_status: string;
      subscription_status: string;
      provider_payment_id: string;
    }>(
      `select p.id as payment_id, p.status as payment_status, s.status as subscription_status, p.provider_payment_id
       from public.payments p join public.subscriptions s on s.id = p.subscription_id where p.provider_order_id = 'order_checkout123'`,
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    const invoice = await database.query<{
      invoice_number: string;
      business_name: string;
      amount_inr: string;
    }>(
      "select invoice_number, business_name, amount_inr from public.get_my_payment_invoice($1)",
      [paid.rows[0].payment_id],
    );
    await database.exec("reset role");
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherId],
    );
    const otherOrder = await database.query<{ count: number }>(
      "select count(*)::int as count from public.get_my_razorpay_order('order_checkout123')",
    );
    await database.exec("reset role");

    expect(quote.rows[0].amount_paise).toBe(19900);
    expect(captured.rows[0].service_process_razorpay_payment_event).toBe(
      "paid",
    );
    expect(duplicate.rows[0].service_process_razorpay_payment_event).toBe(
      "duplicate",
    );
    expect(paid.rows[0]).toEqual({
      payment_id: expect.any(String),
      payment_status: "paid",
      subscription_status: "active",
      provider_payment_id: "pay_checkout123",
    });
    expect(invoice.rows[0]).toMatchObject({
      invoice_number: expect.stringMatching(/^DS-\d{8}-[A-F0-9]{8}$/),
      business_name: "Checkout Pharmacy",
      amount_inr: "199.00",
    });
    expect(otherOrder.rows[0].count).toBe(0);
  });

  it("allows a single subscription trial and expires it through the service job", async () => {
    const ownerId = randomUUID();
    const businessId = randomUUID();
    const planId = randomUUID();
    await database.query(
      "insert into auth.users(id, email, raw_user_meta_data) values ($1, 'trial-owner@example.in', $2)",
      [ownerId, { full_name: "Trial Owner" }],
    );
    const businessType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    await database.query(
      `insert into public.businesses(id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, $3, 'Trial Pharmacy', $4, '+910000000009', 'Main Road', 'approved', now())`,
      [
        businessId,
        ownerId,
        businessType.rows[0].id,
        `trial-${businessId.slice(0, 8)}`,
      ],
    );
    await database.query(
      `insert into public.subscription_plans(id, name, slug, monthly_price_inr, yearly_price_inr, trial_days, is_active)
       values ($1, 'Trial Plan', $2, 199, 1990, 7, true)`,
      [planId, `trial-${planId.slice(0, 8)}`],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    await database.query(
      "select public.start_my_subscription_trial($1, $2, 'monthly')",
      [businessId, planId],
    );
    await expect(
      database.query(
        "select public.start_my_subscription_trial($1, $2, 'monthly')",
        [businessId, planId],
      ),
    ).rejects.toThrow(/already used/i);
    await database.exec("reset role");
    await database.query(
      `update public.subscriptions
       set current_period_start = now() - interval '2 seconds',
           current_period_end = now() - interval '1 second'
       where business_id = $1`,
      [businessId],
    );
    await database.exec("set role service_role");
    const expired = await database.query<{
      expire_stale_subscriptions: number;
    }>("select public.expire_stale_subscriptions()");
    await database.exec("reset role");
    const status = await database.query<{ status: string }>(
      "select status from public.subscriptions where business_id = $1",
      [businessId],
    );
    expect(expired.rows[0].expire_stale_subscriptions).toBe(1);
    expect(status.rows[0].status).toBe("expired");
  });

  it("manages public redirect websites with permission checks and audit history", async () => {
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'redirect-admin@example.in', $2)",
      [adminId, { full_name: "Redirect Administrator" }],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const created = await database.query<{
      admin_save_redirect_website: string;
    }>(
      `select public.admin_save_redirect_website(
        null, 'Click2Book', 'https://click2book.in', null,
        'Doctor Appointment & Booking Platform', 'Book Doctor Appointment', 1, true, true
      )`,
    );
    const listed = await database.query<{
      website_name: string;
      is_active: boolean;
      button_text: string;
    }>(
      "select website_name, is_active, button_text from public.admin_list_redirect_websites()",
    );
    await expect(
      database.query(
        `select public.admin_save_redirect_website(
          $1, 'Click2Book', 'javascript:alert(1)', null, null, 'Book', 1, true, true
        )`,
        [created.rows[0].admin_save_redirect_website],
      ),
    ).rejects.toThrow(/invalid redirect website/i);
    await database.query(
      `select public.admin_save_redirect_website(
        $1, 'Click2Book', 'https://click2book.in/book', null,
        'Doctor appointment booking', 'Book an appointment', 2, true, true
      )`,
      [created.rows[0].admin_save_redirect_website],
    );
    await database.exec("reset role");

    await database.exec("set role anon");
    const publicCount = await database.query<{ count: number }>(
      "select count(*)::int as count from public.redirect_websites",
    );
    await expect(
      database.query(
        `select public.admin_save_redirect_website(
          null, 'Unsafe', 'javascript:alert(1)', null, null, 'Open', 0, true, true
        )`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");

    expect(listed.rows).toEqual([
      {
        website_name: "Click2Book",
        is_active: true,
        button_text: "Book Doctor Appointment",
      },
    ]);
    expect(publicCount.rows[0].count).toBe(1);
    expect(
      (
        await database.query<{ is_active: boolean }>(
          "select is_active from public.redirect_websites where id = $1",
          [created.rows[0].admin_save_redirect_website],
        )
      ).rows[0].is_active,
    ).toBe(true);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    await database.query("select public.admin_delete_redirect_website($1)", [
      created.rows[0].admin_save_redirect_website,
    ]);
    await database.exec("reset role");
    const audit = await database.query<{ count: number }>(
      "select count(*)::int as count from public.audit_logs where record_table = 'redirect_websites' and record_id = $1",
      [created.rows[0].admin_save_redirect_website],
    );
    expect(audit.rows[0].count).toBe(3);
  });

  it("lists only approved, public alternatives with the same composition", async () => {
    const composition = await database.query<{ id: string }>(
      "insert into public.compositions(name, status) values ('Example Active Ingredient', 'approved') returning id",
    );
    const otherComposition = await database.query<{ id: string }>(
      "insert into public.compositions(name, status) values ('Different Ingredient', 'approved') returning id",
    );
    const manufacturer = await database.query<{ id: string }>(
      "insert into public.manufacturers(name, status) values ('Verified Manufacturer', 'approved') returning id",
    );
    const insertMedicine = async (
      name: string,
      compositionId: string,
      options: { status?: string; publicVisibility?: boolean } = {},
    ) =>
      database.query<{ id: string }>(
        `insert into public.medicines(
          product_name, brand_name, composition_id, strength, manufacturer_id,
          medicine_type, prescription_class, public_visibility, status, reviewed_at
        ) values ($1, $2, $3, '500 mg', $4, 'tablet', 'prescription', $5, $6,
          case when $6 = 'approved' then now() else null end) returning id`,
        [
          name,
          name,
          compositionId,
          manufacturer.rows[0].id,
          options.publicVisibility ?? true,
          options.status ?? "approved",
        ],
      );
    const reference = await insertMedicine(
      "Reference Brand",
      composition.rows[0].id,
    );
    await insertMedicine("Public Same Composition", composition.rows[0].id);
    await insertMedicine("Hidden Brand", composition.rows[0].id, {
      publicVisibility: false,
    });
    await insertMedicine("Pending Brand", composition.rows[0].id, {
      status: "pending",
    });
    await insertMedicine(
      "Different Ingredient Brand",
      otherComposition.rows[0].id,
    );

    await database.exec("set role anon");
    const alternatives = await database.query<{
      reference_product_name: string;
      reference_composition: string;
      reference_prescription_class: string;
      alternative_product_name: string | null;
      alternative_manufacturer: string | null;
    }>(
      "select reference_product_name, reference_composition, reference_prescription_class, alternative_product_name, alternative_manufacturer from public.list_public_same_composition_medicines($1)",
      [reference.rows[0].id],
    );
    const privateReference = await database.query<{ count: number }>(
      "select count(*)::int as count from public.list_public_same_composition_medicines($1)",
      [randomUUID()],
    );
    await database.exec("reset role");

    expect(alternatives.rows).toEqual([
      {
        reference_product_name: "Reference Brand",
        reference_composition: "Example Active Ingredient",
        reference_prescription_class: "prescription",
        alternative_product_name: "Public Same Composition",
        alternative_manufacturer: "Verified Manufacturer",
      },
    ]);
    expect(privateReference.rows[0].count).toBe(0);
  });

  it("publishes only approved-window partner promotions and audits admin changes", async () => {
    const adminId = randomUUID();
    const ownerId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'promotion-admin@example.in', $2), ($3, 'promotion-owner@example.in', $4)",
      [
        adminId,
        { full_name: "Promotion Admin" },
        ownerId,
        { full_name: "Promotion Owner" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    const retail = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at, public_availability_enabled)
       values ($1, $2, 'Promotion Pharmacy', 'promotion-pharmacy', '+910000000019', 'Main Road', 'approved', now(), true) returning id`,
      [ownerId, retailType.rows[0].id],
    );
    const distributor = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at, public_availability_enabled)
       values ($1, $2, 'Private Stockist', 'promotion-stockist', '+910000000018', 'Main Road', 'approved', now(), true) returning id`,
      [ownerId, distributorType.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const active = await database.query<{ admin_save_promotion: string }>(
      `select public.admin_save_promotion(null, $1, 'Store opening offer', 'Ask the pharmacy for current details.', 'sponsored_listing', 'active', now() - interval '1 day', now() + interval '2 days')`,
      [retail.rows[0].id],
    );
    await expect(
      database.query(
        `select public.admin_save_promotion(null, $1, 'B2B promotion', null, 'sponsored_listing', 'active', null, null)`,
        [distributor.rows[0].id],
      ),
    ).rejects.toThrow(/approved public partner/i);
    await database.query(
      `select public.admin_save_promotion(null, $1, 'Future feature', null, 'featured_listing', 'scheduled', now() + interval '2 days', now() + interval '3 days')`,
      [retail.rows[0].id],
    );
    await database.exec("reset role");

    await database.exec("set role anon");
    const publicPromotions = await database.query<{
      title: string;
      promotion_type: string;
    }>(
      "select title, promotion_type from public.list_public_business_promotions($1)",
      [retail.rows[0].id],
    );
    await expect(
      database.query("select * from public.admin_list_promotions()"),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");
    expect(publicPromotions.rows).toEqual([
      { title: "Store opening offer", promotion_type: "sponsored_listing" },
    ]);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    await database.query("select public.admin_delete_promotion($1)", [
      active.rows[0].admin_save_promotion,
    ]);
    await database.exec("reset role");
    const audit = await database.query<{ count: number }>(
      "select count(*)::int as count from public.audit_logs where record_table = 'promotions'",
    );
    expect(audit.rows[0].count).toBe(3);
  });

  it("moderates customer reviews and exposes only anonymous approved feedback", async () => {
    const customerId = randomUUID();
    const ownerId = randomUUID();
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'review-customer@example.in', $2), ($3, 'review-owner@example.in', $4), ($5, 'review-admin@example.in', $6)",
      [
        customerId,
        { full_name: "Private Reviewer Name" },
        ownerId,
        { full_name: "Review Business Owner" },
        adminId,
        { full_name: "Review Moderator" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const business = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at, public_availability_enabled)
       values ($1, $2, 'Review Pharmacy', 'review-pharmacy', '+910000000017', 'Main Road', 'approved', now(), true) returning id`,
      [ownerId, retailType.rows[0].id],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const saved = await database.query<{ save_my_business_review: string }>(
      "select public.save_my_business_review($1, 5::smallint, 'Helpful and respectful staff.')",
      [business.rows[0].id],
    );
    const ownReview = await database.query<{ status: string; rating: number }>(
      "select status, rating from public.get_my_business_review($1)",
      [business.rows[0].id],
    );
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    await expect(
      database.query(
        "select public.save_my_business_review($1, 5::smallint, 'I cannot review my own pharmacy.')",
        [business.rows[0].id],
      ),
    ).rejects.toThrow(/not allowed/i);
    await database.exec("reset role");

    await database.exec("set role anon");
    const beforeModeration = await database.query<{ count: number }>(
      "select count(*)::int as count from public.list_public_business_reviews($1)",
      [business.rows[0].id],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const pending = await database.query<{ customer_name: string }>(
      "select customer_name from public.admin_list_business_reviews('pending') where review_id = $1",
      [saved.rows[0].save_my_business_review],
    );
    await database.query(
      "select public.admin_review_business_review($1, 'approved')",
      [saved.rows[0].save_my_business_review],
    );
    await database.exec("reset role");

    await database.exec("set role anon");
    const publicReviews = await database.query<{
      rating: number;
      review_text: string;
    }>(
      "select rating, review_text from public.list_public_business_reviews($1)",
      [business.rows[0].id],
    );
    await database.exec("reset role");

    expect(ownReview.rows).toEqual([{ status: "pending", rating: 5 }]);
    expect(beforeModeration.rows[0].count).toBe(0);
    expect(pending.rows).toEqual([{ customer_name: "Private Reviewer Name" }]);
    expect(publicReviews.rows).toEqual([
      { rating: 5, review_text: "Helpful and respectful staff." },
    ]);
  });

  it("lets partners request promotions while keeping approval and business scope server controlled", async () => {
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'promo-owner@example.in', $2), ($3, 'promo-other@example.in', $4)",
      [
        ownerId,
        { full_name: "Promotion Owner" },
        otherOwnerId,
        { full_name: "Other Owner" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    const ownedBusiness = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, 'Partner Promotion Pharmacy', 'partner-promotion-pharmacy', '+910000000016', 'Main Road', 'approved', now()) returning id`,
      [ownerId, retailType.rows[0].id],
    );
    const otherBusiness = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, 'Another Promotion Pharmacy', 'another-promotion-pharmacy', '+910000000015', 'Main Road', 'approved', now()) returning id`,
      [otherOwnerId, retailType.rows[0].id],
    );
    const distributor = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, 'B2B Promotion Stockist', 'b2b-promotion-stockist', '+910000000014', 'Main Road', 'approved', now()) returning id`,
      [ownerId, distributorType.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    const submitted = await database.query<{
      save_my_business_promotion: string;
    }>(
      `select public.save_my_business_promotion(null, $1, 'Opening week offer', 'Ask in store for details.', 'offer', now(), now() + interval '7 days')`,
      [ownedBusiness.rows[0].id],
    );
    const ownRequests = await database.query<{
      status: string;
      title: string;
    }>("select status, title from public.list_my_business_promotions($1)", [
      ownedBusiness.rows[0].id,
    ]);
    await expect(
      database.query("select * from public.list_my_business_promotions($1)", [
        otherBusiness.rows[0].id,
      ]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        `select public.save_my_business_promotion(null, $1, 'Wrong store', null, 'offer', null, null)`,
        [otherBusiness.rows[0].id],
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        `select public.save_my_business_promotion(null, $1, 'Stockist deal', null, 'offer', null, null)`,
        [distributor.rows[0].id],
      ),
    ).rejects.toThrow(/approved partner not found/i);
    await database.exec("reset role");

    await database.query(
      "update public.promotions set status = 'rejected' where id = $1",
      [submitted.rows[0].save_my_business_promotion],
    );
    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    await database.query(
      `select public.save_my_business_promotion($1, $2, 'Updated offer', null, 'featured_listing', now(), now() + interval '7 days')`,
      [submitted.rows[0].save_my_business_promotion, ownedBusiness.rows[0].id],
    );
    const resubmitted = await database.query<{ status: string; title: string }>(
      "select status, title from public.list_my_business_promotions($1)",
      [ownedBusiness.rows[0].id],
    );
    await database.exec("reset role");

    expect(ownRequests.rows).toEqual([
      { status: "pending", title: "Opening week offer" },
    ]);
    expect(resubmitted.rows).toEqual([
      { status: "pending", title: "Updated offer" },
    ]);
  });

  it("restricts private support files to active uploaders and ticket participants", async () => {
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    const supportAdminId = randomUUID();
    const attachmentPath = `${ownerId}/${randomUUID()}.pdf`;
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'attachment-owner@example.in', $2), ($3, 'attachment-other@example.in', $4), ($5, 'attachment-admin@example.in', $6)",
      [
        ownerId,
        { full_name: "Attachment Owner" },
        otherUserId,
        { full_name: "Other Customer" },
        supportAdminId,
        { full_name: "Support Admin" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [supportAdminId, superRole.rows[0].id],
    );
    const ticket = await database.query<{ id: string }>(
      `insert into public.support_tickets(requester_user_id, category, subject, description, attachment_path)
       values ($1, 'account', 'Attachment access check', 'Check private attachment access.', $2) returning id`,
      [ownerId, attachmentPath],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    await database.query(
      "insert into storage.objects(bucket_id, name, owner_id) values ('support-attachments', $1, $2)",
      [attachmentPath, ownerId],
    );
    const ownFiles = await database.query<{ count: number }>(
      "select count(*)::int as count from storage.objects where bucket_id = 'support-attachments'",
    );
    await expect(
      database.query(
        "insert into storage.objects(bucket_id, name, owner_id) values ('support-attachments', $1, $2)",
        [`${otherUserId}/${randomUUID()}.pdf`, ownerId],
      ),
    ).rejects.toThrow();
    await expect(
      database.query(
        `insert into public.support_tickets(requester_user_id, category, subject, description, attachment_path)
         values ($1, 'account', 'Foreign file check', 'Try to attach another user file.', $2)`,
        [ownerId, `${otherUserId}/${randomUUID()}.pdf`],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherUserId],
    );
    const otherFiles = await database.query<{ count: number }>(
      "select count(*)::int as count from storage.objects where bucket_id = 'support-attachments'",
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [supportAdminId],
    );
    const supportFiles = await database.query<{ count: number }>(
      "select count(*)::int as count from storage.objects where bucket_id = 'support-attachments'",
    );
    const adminTicket = await database.query<{ attachment_path: string }>(
      "select attachment_path from public.admin_list_support_tickets() where ticket_id = $1",
      [ticket.rows[0].id],
    );
    await database.exec("reset role");

    expect(ownFiles.rows[0].count).toBe(1);
    expect(otherFiles.rows[0].count).toBe(0);
    expect(supportFiles.rows[0].count).toBe(1);
    expect(adminTicket.rows).toEqual([{ attachment_path: attachmentPath }]);
  });

  it("requires AAL2 for privileged database permissions when an admin enables MFA", async () => {
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'mfa-admin@example.in', $2)",
      [adminId, { full_name: "MFA Admin" }],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );

    await database.exec("set role service_role");
    await database.query("select public.service_sync_security_mfa($1, true)", [
      adminId,
    ]);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    await database.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ aal: "aal1" }),
    ]);
    const aal1Permission = await database.query<{ allowed: boolean }>(
      "select public.has_platform_permission('security.manage') as allowed",
    );
    await expect(
      database.query("select * from public.admin_list_promotions()"),
    ).rejects.toThrow(/permission denied/i);

    await database.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ aal: "aal2" }),
    ]);
    const aal2Permission = await database.query<{ allowed: boolean }>(
      "select public.has_platform_permission('security.manage') as allowed",
    );
    await expect(
      database.query("select public.service_sync_security_mfa($1, false)", [
        adminId,
      ]),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");
    const audit = await database.query<{ action: string }>(
      "select action from public.audit_logs where actor_user_id = $1 and module = 'security'",
      [adminId],
    );

    expect(aal1Permission.rows).toEqual([{ allowed: false }]);
    expect(aal2Permission.rows).toEqual([{ allowed: true }]);
    expect(audit.rows).toEqual([{ action: "security.mfa_enabled" }]);
  });

  it("keeps partner verification files private and lets authorized admins review them", async () => {
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'document-owner@example.in', $2), ($3, 'document-other@example.in', $4), ($5, 'document-admin@example.in', $6)",
      [
        ownerId,
        { full_name: "Document Owner" },
        otherOwnerId,
        { full_name: "Other Partner" },
        adminId,
        { full_name: "Document Reviewer" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const business = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, 'Document Pharmacy', 'document-pharmacy', '+910000000013', 'Main Road') returning id`,
      [ownerId, retailType.rows[0].id],
    );
    const otherBusiness = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1)
       values ($1, $2, 'Other Document Pharmacy', 'other-document-pharmacy', '+910000000012', 'Main Road') returning id`,
      [otherOwnerId, retailType.rows[0].id],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    const storagePath = `${business.rows[0].id}/${ownerId}/${randomUUID()}.pdf`;

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    await database.query(
      "insert into storage.objects(bucket_id, name, owner_id) values ('business-documents', $1, $2)",
      [storagePath, ownerId],
    );
    const saved = await database.query<{
      save_my_business_document: string;
    }>("select public.save_my_business_document($1, 'license', $2)", [
      business.rows[0].id,
      storagePath,
    ]);
    const ownDocuments = await database.query<{
      document_type: string;
      status: string;
    }>(
      "select document_type, status from public.list_my_business_documents($1)",
      [business.rows[0].id],
    );
    const orphanPath = `${business.rows[0].id}/${ownerId}/${randomUUID()}.pdf`;
    await database.query(
      "insert into storage.objects(bucket_id, name, owner_id) values ('business-documents', $1, $2)",
      [orphanPath, ownerId],
    );
    await database.query("delete from storage.objects where name = $1", [
      orphanPath,
    ]);
    const linkedFileDelete = await database.query(
      "delete from storage.objects where name = $1",
      [storagePath],
    );
    expect(linkedFileDelete.rowCount).toBe(0);
    await expect(
      database.query("select * from public.list_my_business_documents($1)", [
        otherBusiness.rows[0].id,
      ]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        "insert into storage.objects(bucket_id, name, owner_id) values ('business-documents', $1, $2)",
        [`${otherBusiness.rows[0].id}/${ownerId}/${randomUUID()}.pdf`, ownerId],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherOwnerId],
    );
    const otherDocuments = await database.query<{ count: number }>(
      "select count(*)::int as count from public.business_documents",
    );
    const otherFiles = await database.query<{ count: number }>(
      "select count(*)::int as count from storage.objects where bucket_id = 'business-documents'",
    );
    const unauthorizedPath = await database.query<{ count: number }>(
      "select count(*)::int as count from public.get_authorized_business_document_path($1)",
      [saved.rows[0].save_my_business_document],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const adminDocuments = await database.query<{
      document_id: string;
      status: string;
    }>(
      "select document_id, status from public.admin_list_business_documents($1)",
      [business.rows[0].id],
    );
    await database.query(
      "select public.admin_review_business_document($1, 'approved', 'License details verified.')",
      [saved.rows[0].save_my_business_document],
    );
    const updated = await database.query<{ status: string }>(
      "select status from public.business_documents where id = $1",
      [saved.rows[0].save_my_business_document],
    );
    await database.exec("reset role");

    const audit = await database.query<{ action: string }>(
      "select action from public.audit_logs where record_id = $1 order by created_at, action",
      [saved.rows[0].save_my_business_document],
    );
    expect(ownDocuments.rows).toEqual([
      { document_type: "license", status: "pending" },
    ]);
    expect(otherDocuments.rows[0].count).toBe(0);
    expect(otherFiles.rows[0].count).toBe(0);
    expect(unauthorizedPath.rows[0].count).toBe(0);
    expect(adminDocuments.rows).toEqual([
      {
        document_id: saved.rows[0].save_my_business_document,
        status: "pending",
      },
    ]);
    expect(updated.rows).toEqual([{ status: "approved" }]);
    expect(audit.rows.map((row) => row.action).sort()).toEqual(
      ["partner.document_reviewed", "partner.document_uploaded"].sort(),
    );
    expect(storagePath.startsWith(`${business.rows[0].id}/${ownerId}/`)).toBe(
      true,
    );
  });

  it("records daily unique usage events and returns permission-scoped analytics", async () => {
    const ownerId = randomUUID();
    const customerId = randomUUID();
    const otherUserId = randomUUID();
    const adminId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'analytics-owner@example.in', $2), ($3, 'analytics-customer@example.in', $4), ($5, 'analytics-other@example.in', $6), ($7, 'analytics-admin@example.in', $8)",
      [
        ownerId,
        { full_name: "Analytics Owner" },
        customerId,
        { full_name: "Analytics Customer" },
        otherUserId,
        { full_name: "Other Partner" },
        adminId,
        { full_name: "Analytics Admin" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const business = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at, public_availability_enabled)
       values ($1, $2, 'Analytics Pharmacy', $3, '+910000000010', 'Main Road', 'approved', now(), true) returning id`,
      [ownerId, retailType.rows[0].id, `analytics-${randomUUID().slice(0, 8)}`],
    );
    const medicine = await database.query<{ id: string }>(
      `insert into public.medicines(product_name, strength, medicine_type, status, reviewed_at, public_visibility)
       values ('Analytics Medicine', '10 mg', 'tablet', 'approved', now(), true) returning id`,
    );
    await database.query(
      `insert into public.inventory(business_id, medicine_id, status, quantity)
       values ($1, $2, 'available', 5)`,
      [business.rows[0].id, medicine.rows[0].id],
    );
    await database.query(
      `insert into public.inventory_visibility(inventory_id, public_visible)
       select id, true from public.inventory where business_id = $1 and medicine_id = $2`,
      [business.rows[0].id, medicine.rows[0].id],
    );
    const request = await database.query<{ id: string }>(
      `insert into public.medicine_requests(customer_user_id, medicine_id, requested_medicine_name)
       values ($1, $2, 'Analytics Medicine') returning id`,
      [customerId, medicine.rows[0].id],
    );
    await database.query(
      `insert into public.medicine_request_responses(request_id, business_id, response, responded_by)
       values ($1, $2, 'available', $3)`,
      [request.rows[0].id, business.rows[0].id, ownerId],
    );
    await database.query(
      `insert into public.inquiries(customer_user_id, business_id, medicine_id, message)
       values ($1, $2, $3, 'Please confirm availability.')`,
      [customerId, business.rows[0].id, medicine.rows[0].id],
    );
    await database.query(
      `insert into public.orders(customer_user_id, business_id, medicine_request_id, status)
       values ($1, $2, $3, 'confirmed')`,
      [customerId, business.rows[0].id, request.rows[0].id],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    const visitorHash = "a".repeat(64);

    await database.exec("set role service_role");
    const ownProfileView = await database.query<{
      service_record_business_profile_view: boolean;
    }>("select public.service_record_business_profile_view($1, $2, $3)", [
      business.rows[0].id,
      ownerId,
      "b".repeat(64),
    ]);
    const profileView = await database.query<{
      service_record_business_profile_view: boolean;
    }>("select public.service_record_business_profile_view($1, null, $2)", [
      business.rows[0].id,
      visitorHash,
    ]);
    const repeatedProfileView = await database.query<{
      service_record_business_profile_view: boolean;
    }>("select public.service_record_business_profile_view($1, null, $2)", [
      business.rows[0].id,
      visitorHash,
    ]);
    const searchEvent = await database.query<{
      service_record_medicine_searches: number;
    }>(
      "select public.service_record_medicine_searches(array[$1::uuid], array[$2::text])",
      [medicine.rows[0].id, visitorHash],
    );
    const repeatedSearch = await database.query<{
      service_record_medicine_searches: number;
    }>(
      "select public.service_record_medicine_searches(array[$1::uuid], array[$2::text])",
      [medicine.rows[0].id, visitorHash],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [ownerId],
    );
    const partnerMetrics = await database
      .query<{
        profile_views: number;
        medicine_searches: number;
        medicine_requests: number;
        inquiries: number;
        confirmed_orders: number;
        available_inventory: number;
        total_inventory: number;
      }>("select * from public.list_my_business_analytics($1, 30)", [
        business.rows[0].id,
      ])
      .catch((error) => {
        throw new Error(`Partner analytics query failed: ${String(error)}`);
      });
    const trends = await database
      .query<{
        product_name: string;
        search_count: number;
        inventory_status: string;
      }>(
        "select product_name, search_count, inventory_status from public.list_my_business_search_trends($1, 30)",
        [business.rows[0].id],
      )
      .catch((error) => {
        throw new Error(`Partner search trends query failed: ${String(error)}`);
      });
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [otherUserId],
    );
    await expect(
      database.query(
        "select * from public.list_my_business_analytics($1, 30)",
        [business.rows[0].id],
      ),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const adminMetrics = await database
      .query<{
        medicine_searches: number;
        profile_views: number;
        medicine_requests: number;
      }>(
        "select medicine_searches, profile_views, medicine_requests from public.admin_get_analytics_summary(30)",
      )
      .catch((error) => {
        throw new Error(
          `Admin analytics summary query failed: ${String(error)}`,
        );
      });
    const topSearches = await database
      .query<{
        product_name: string;
        search_count: number;
      }>(
        "select product_name, search_count from public.admin_list_top_medicine_searches(30)",
      )
      .catch((error) => {
        throw new Error(`Admin top searches query failed: ${String(error)}`);
      });
    await database.exec("reset role");

    expect(ownProfileView.rows[0].service_record_business_profile_view).toBe(
      false,
    );
    expect(profileView.rows[0].service_record_business_profile_view).toBe(true);
    expect(
      repeatedProfileView.rows[0].service_record_business_profile_view,
    ).toBe(false);
    expect(searchEvent.rows[0].service_record_medicine_searches).toBe(1);
    expect(repeatedSearch.rows[0].service_record_medicine_searches).toBe(0);
    expect(partnerMetrics.rows[0]).toEqual({
      profile_views: 1,
      medicine_searches: 1,
      medicine_requests: 1,
      inquiries: 1,
      confirmed_orders: 1,
      available_inventory: 1,
      total_inventory: 1,
    });
    expect(trends.rows).toEqual([
      {
        product_name: "Analytics Medicine",
        search_count: 1,
        inventory_status: "available",
      },
    ]);
    expect(adminMetrics.rows[0]).toMatchObject({
      medicine_searches: 1,
      profile_views: 1,
    });
    expect(adminMetrics.rows[0].medicine_requests).toBeGreaterThanOrEqual(1);
    expect(topSearches.rows).toEqual([
      { product_name: "Analytics Medicine", search_count: 1 },
    ]);
  });

  it("seeds public medicine categories and permission-checks audited category management", async () => {
    const adminId = randomUUID();
    const customerId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'categories-admin@example.in', $2), ($3, 'categories-customer@example.in', $4)",
      [
        adminId,
        { full_name: "Category Administrator" },
        customerId,
        { full_name: "Category Customer" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    const seeded = await database.query<{ name: string }>(
      "select name from public.categories where is_active order by display_order",
    );
    expect(seeded.rows.map((row) => row.name)).toEqual([
      "Pain Relief",
      "Antibiotics",
      "Diabetes Care",
      "Cardiac Care",
      "Vitamins & Supplements",
      "Respiratory Care",
      "Gastro Care",
      "Skin Care",
    ]);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await expect(
      database.query("select * from public.admin_list_medicine_categories()"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        "select public.admin_save_medicine_category(null, 'supplements', 'Supplements', null, true, 90)",
      ),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const created = await database.query<{
      admin_save_medicine_category: string;
    }>(
      "select public.admin_save_medicine_category(null, 'eye-care', 'Eye Care', 'Vision and eye care products.', true, 90)",
    );
    await database.query(
      "select public.admin_save_medicine_category($1, 'eye-care', 'Eye Health', 'Eye care products.', false, 90)",
      [created.rows[0].admin_save_medicine_category],
    );
    await expect(
      database.query(
        "select public.admin_save_medicine_category(null, 'bad slug', 'Invalid', null, true, 90)",
      ),
    ).rejects.toThrow(/invalid category details/i);
    const managed = await database.query<{
      name: string;
      is_active: boolean;
    }>(
      "select name, is_active from public.admin_list_medicine_categories() where category_id = $1",
      [created.rows[0].admin_save_medicine_category],
    );
    await database.exec("reset role");

    const audit = await database.query<{ action: string; new_value: object }>(
      "select action, new_value from public.audit_logs where record_id = $1 order by created_at, action",
      [created.rows[0].admin_save_medicine_category],
    );
    expect(managed.rows).toEqual([{ name: "Eye Health", is_active: false }]);
    expect(audit.rows.map((row) => row.action)).toEqual([
      "category.created",
      "category.updated",
    ]);
    expect(audit.rows[1].new_value).toMatchObject({ name: "Eye Health" });
  });

  it("limits refunds to finance, reserves balances, and processes signed refund events idempotently", async () => {
    const adminId = randomUUID();
    const ownerId = randomUUID();
    const customerId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'refund-admin@example.in', $2), ($3, 'refund-owner@example.in', $4), ($5, 'refund-customer@example.in', $6)",
      [
        adminId,
        { full_name: "Refund Administrator" },
        ownerId,
        { full_name: "Refund Partner" },
        customerId,
        { full_name: "Refund Customer" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const business = await database.query<{ id: string }>(
      `insert into public.businesses(owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at)
       values ($1, $2, 'Refund Pharmacy', $3, '+910000000012', 'High Street', 'approved', now()) returning id`,
      [ownerId, retailType.rows[0].id, `refund-${randomUUID().slice(0, 8)}`],
    );
    const payment = await database.query<{ id: string }>(
      `insert into public.payments(business_id, provider, provider_payment_id, amount_inr, currency, status, paid_at)
       values ($1, 'razorpay', 'pay_RefundFixture1', 1000, 'INR', 'paid', now()) returning id`,
      [business.rows[0].id],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await expect(
      database.query("select * from public.admin_list_refundable_payments()"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        "select * from public.admin_reserve_payment_refund($1, 30000, 'Customer cancellation')",
        [payment.rows[0].id],
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query("select * from public.payment_refund_requests"),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const request = await database.query<{
      refund_request_id: string;
      provider_payment_id: string;
    }>(
      "select * from public.admin_reserve_payment_refund($1, 30000, 'Customer cancellation')",
      [payment.rows[0].id],
    );
    expect(request.rows[0].provider_payment_id).toBe("pay_RefundFixture1");
    await expect(
      database.query(
        "select * from public.admin_reserve_payment_refund($1, 10000, 'Duplicate pending request')",
        [payment.rows[0].id],
      ),
    ).rejects.toThrow();
    const worklist = await database.query<{
      refundable_balance_inr: string;
      pending_refund_id: string;
      pending_refund_status: string;
    }>(
      "select refundable_balance_inr, pending_refund_id, pending_refund_status from public.admin_list_refundable_payments() where payment_id = $1",
      [payment.rows[0].id],
    );
    await database.exec("reset role");
    expect(worklist.rows).toEqual([
      {
        refundable_balance_inr: "700.00",
        pending_refund_id: request.rows[0].refund_request_id,
        pending_refund_status: "requested",
      },
    ]);

    await database.exec("set role service_role");
    await database.query(
      "select public.service_update_payment_refund_request($1, 'pending', 'rfnd_RefundFixture1')",
      [request.rows[0].refund_request_id],
    );
    const processed = await database.query<{
      service_process_payment_refund_event: string;
    }>(
      "select public.service_process_payment_refund_event('refund-event-1', $1, $2, 'rfnd_RefundFixture1', 30000, 'INR')",
      [request.rows[0].refund_request_id, "pay_RefundFixture1"],
    );
    const repeated = await database.query<{
      service_process_payment_refund_event: string;
    }>(
      "select public.service_process_payment_refund_event('refund-event-1', $1, $2, 'rfnd_RefundFixture1', 30000, 'INR')",
      [request.rows[0].refund_request_id, "pay_RefundFixture1"],
    );
    await database.exec("reset role");

    const partiallyRefunded = await database.query<{
      status: string;
      refunded_amount_inr: string;
    }>(
      "select status, refunded_amount_inr from public.payments where id = $1",
      [payment.rows[0].id],
    );
    expect(processed.rows[0].service_process_payment_refund_event).toBe(
      "processed",
    );
    expect(repeated.rows[0].service_process_payment_refund_event).toBe(
      "duplicate",
    );
    expect(partiallyRefunded.rows).toEqual([
      { status: "partially_refunded", refunded_amount_inr: "300.00" },
    ]);

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const remainder = await database.query<{ refund_request_id: string }>(
      "select refund_request_id from public.admin_reserve_payment_refund($1, 70000, 'Remainder refund')",
      [payment.rows[0].id],
    );
    await expect(
      database.query(
        "select * from public.admin_reserve_payment_refund($1, 1, 'Too much')",
        [payment.rows[0].id],
      ),
    ).rejects.toThrow(/refundable amount/i);
    await database.exec("reset role");

    await database.exec("set role service_role");
    await database.query(
      "select public.service_update_payment_refund_request($1, 'pending', 'rfnd_RefundFixture2')",
      [remainder.rows[0].refund_request_id],
    );
    await database.query(
      "select public.service_process_payment_refund_event('refund-event-2', $1, $2, 'rfnd_RefundFixture2', 70000, 'INR')",
      [remainder.rows[0].refund_request_id, "pay_RefundFixture1"],
    );
    await database.exec("reset role");

    const fullyRefunded = await database.query<{
      status: string;
      refunded_amount_inr: string;
    }>(
      "select status, refunded_amount_inr from public.payments where id = $1",
      [payment.rows[0].id],
    );
    const audit = await database.query<{ action: string }>(
      "select action from public.audit_logs where record_table = 'payment_refund_requests' and record_id in ($1, $2) order by created_at, action",
      [request.rows[0].refund_request_id, remainder.rows[0].refund_request_id],
    );
    expect(fullyRefunded.rows).toEqual([
      { status: "refunded", refunded_amount_inr: "1000.00" },
    ]);
    expect(audit.rows.map((row) => row.action)).toContain(
      "payment.refund_processed",
    );
    expect(audit.rows.map((row) => row.action)).toContain(
      "payment.refund_requested",
    );
  });

  it("stores verified security recovery contacts and never returns PIN hashes", async () => {
    const userId = randomUUID();
    await database.query(
      `insert into auth.users (
         id, raw_user_meta_data, email, email_confirmed_at, phone, phone_confirmed_at
       ) values ($1, $2, 'security@example.in', now(), '+919876543210', now())`,
      [userId, { full_name: "Security User" }],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [userId],
    );
    await database.query(
      "select public.save_my_security_recovery_contacts('security@example.in', '+919876543210')",
    );
    await expect(
      database.query(
        "select public.save_my_security_recovery_contacts('other@example.in', '+919876543210')",
      ),
    ).rejects.toThrow(/verified on the account/i);
    await expect(
      database.query("select security_pin_hash from public.security_settings"),
    ).rejects.toThrow();
    const beforePin = await database.query<{
      recovery_email: string;
      recovery_phone_e164: string;
      has_security_pin: boolean;
      mfa_enabled: boolean;
    }>("select * from public.get_my_security_recovery_settings()");
    expect(beforePin.rows).toEqual([
      {
        recovery_email: "security@example.in",
        recovery_phone_e164: "+919876543210",
        has_security_pin: false,
        mfa_enabled: false,
      },
    ]);
    const pinHash = `scrypt$16384$8$1$${"ab".repeat(16)}$${"cd".repeat(64)}`;
    await expect(
      database.query("select public.service_save_security_pin_hash($1, $2)", [
        userId,
        pinHash,
      ]),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role service_role");
    await database.query(
      "select public.service_save_security_pin_hash($1, $2)",
      [userId, pinHash],
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await database.query<{
        service_record_security_pin_attempt: boolean;
      }>("select public.service_record_security_pin_attempt($1, false)", [
        userId,
      ]);
      expect(result.rows[0].service_record_security_pin_attempt).toBe(false);
    }
    await database.exec("reset role");
    const lockedSettings = await database.query<{
      failed_attempt_count: number;
      locked_until: string | null;
    }>(
      "select failed_attempt_count, locked_until from public.security_settings where user_id = $1",
      [userId],
    );
    expect(lockedSettings.rows[0].failed_attempt_count).toBe(5);
    expect(lockedSettings.rows[0].locked_until).not.toBeNull();

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [userId],
    );
    const afterPin = await database.query<{
      has_security_pin: boolean;
    }>("select * from public.get_my_security_recovery_settings()");
    expect(afterPin.rows[0].has_security_pin).toBe(true);
    await database.exec("reset role");
  });

  it("publishes only active doctor booking profiles with approved Click2Book links", async () => {
    const adminId = randomUUID();
    const customerId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'doctors-admin@example.in', $2), ($3, 'doctors-customer@example.in', $4)",
      [
        adminId,
        { full_name: "Doctor Directory Admin" },
        customerId,
        { full_name: "Doctor Directory Customer" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    const businessTypes = await database.query<{ id: string; slug: string }>(
      "select id, slug from public.business_types where slug in ('clinic_pharmacy', 'retail_pharmacy')",
    );
    const clinicBusinessId = randomUUID();
    const retailBusinessId = randomUUID();
    const clinicTypeId = businessTypes.rows.find(
      (type) => type.slug === "clinic_pharmacy",
    )?.id;
    const retailTypeId = businessTypes.rows.find(
      (type) => type.slug === "retail_pharmacy",
    )?.id;
    if (!clinicTypeId || !retailTypeId)
      throw new Error("Business types missing");
    await database.query(
      `insert into public.businesses (
        id, owner_user_id, business_type_id, business_name, slug, phone_e164,
        address_line1, status, reviewed_at, reviewed_by
      ) values
        ($1, $2, $3, 'Approved Clinic', 'approved-clinic', '+919876543210',
          '12 Clinic Road', 'approved', now(), $4),
        ($5, $2, $6, 'Retail Pharmacy', 'retail-pharmacy', '+919876543211',
          '14 Market Road', 'approved', now(), $4)`,
      [
        clinicBusinessId,
        customerId,
        clinicTypeId,
        adminId,
        retailBusinessId,
        retailTypeId,
      ],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await expect(
      database.query(
        "select * from public.admin_list_doctor_booking_profiles()",
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query(
        "select public.admin_save_doctor_booking_profile(null, null, 'Dr. Test', 'dr-test', 'Cardiology', null, 'https://evil.example/book', 0, true)",
      ),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    const created = await database.query<{ id: string }>(
      `select public.admin_save_doctor_booking_profile(
        null, $1, 'Dr. Asha Rao', 'dr-asha-rao', 'Cardiology',
        'Consultant cardiologist.', 'https://click2book.in/doctors/dr-asha-rao', 0, true
      ) as id`,
      [clinicBusinessId],
    );
    await database.query(
      `select public.admin_save_doctor_booking_profile(
        null, null, 'Dr. Hidden', 'dr-hidden', 'General medicine', null,
        'https://click2book.in/doctors/dr-hidden', 1, false
      )`,
    );
    await expect(
      database.query(
        `select public.admin_save_doctor_booking_profile(
          null, null, 'Dr. Unsafe', 'dr-unsafe', 'General medicine', null,
          'https://click2book.in.evil.example/book', 2, true
        )`,
      ),
    ).rejects.toThrow(/invalid doctor booking profile/i);
    await expect(
      database.query(
        `select public.admin_save_doctor_booking_profile(
          null, $1, 'Dr. Retail', 'dr-retail', 'Cardiology', null,
          'https://click2book.in/doctors/dr-retail', 3, true
        )`,
        [retailBusinessId],
      ),
    ).rejects.toThrow(/invalid doctor booking profile/i);
    await database.exec("reset role");

    await database.exec("set role anon");
    const publicProfiles = await database.query<{
      slug: string;
      full_name: string;
    }>(
      "select slug, full_name from public.list_public_doctor_booking_profiles()",
    );
    const publicProfile = await database.query<{
      booking_url: string;
    }>(
      "select booking_url from public.get_public_doctor_booking_profile('dr-asha-rao')",
    );
    await expect(
      database.query("select * from public.doctor_booking_profiles"),
    ).rejects.toThrow();
    await database.exec("reset role");

    expect(publicProfiles.rows).toEqual([
      { slug: "dr-asha-rao", full_name: "Dr. Asha Rao" },
    ]);
    expect(publicProfile.rows).toEqual([
      { booking_url: "https://click2book.in/doctors/dr-asha-rao" },
    ]);
    const audit = await database.query<{ action: string }>(
      "select action from public.audit_logs where record_id = $1",
      [created.rows[0].id],
    );
    expect(audit.rows.map((row) => row.action)).toContain(
      "doctor_booking_profile.created",
    );
  });

  it("routes private pharmacy inquiries and partner replies through permission-checked database functions", async () => {
    const customerId = randomUUID();
    const partnerId = randomUUID();
    const publicBusinessId = randomUUID();
    const distributorBusinessId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'inquiry-customer@example.in', $2), ($3, 'inquiry-partner@example.in', $4)",
      [
        customerId,
        { full_name: "Inquiry Customer" },
        partnerId,
        { full_name: "Inquiry Partner" },
      ],
    );
    const retailType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'retail_pharmacy'",
    );
    const distributorType = await database.query<{ id: string }>(
      "select id from public.business_types where slug = 'distributor'",
    );
    await database.query(
      `insert into public.businesses(id, owner_user_id, business_type_id, business_name, slug, phone_e164, address_line1, status, reviewed_at, public_availability_enabled)
       values ($1, $2, $3, 'Inquiry Pharmacy', $4, '+910000000099', 'Market Road', 'approved', now(), true),
              ($5, $2, $6, 'Private Stockist', $7, '+910000000098', 'Warehouse Road', 'approved', now(), true)`,
      [
        publicBusinessId,
        partnerId,
        retailType.rows[0].id,
        `inquiry-pharmacy-${publicBusinessId.slice(0, 8)}`,
        distributorBusinessId,
        distributorType.rows[0].id,
        `private-stockist-${distributorBusinessId.slice(0, 8)}`,
      ],
    );

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const created = await database.query<{ id: string }>(
      "select public.create_partner_inquiry($1, null, 'Please confirm whether the pharmacy is open this evening.') as id",
      [publicBusinessId],
    );
    await expect(
      database.query(
        "select public.create_partner_inquiry($1, null, 'This must not reach a distributor.')",
        [distributorBusinessId],
      ),
    ).rejects.toThrow(/not accepting inquiries/i);
    await expect(
      database.query(
        `insert into public.inquiries(customer_user_id, business_id, message)
         values ($1, $2, 'Direct inserts must be blocked')`,
        [customerId, publicBusinessId],
      ),
    ).rejects.toThrow();
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [partnerId],
    );
    await database.query(
      "select public.respond_to_partner_inquiry($1, $2, 'We are open until 9 PM. Please call before you visit.')",
      [publicBusinessId, created.rows[0].id],
    );
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    const ownInquiry = await database.query<{
      status: string;
      response_message: string;
    }>("select status, response_message from public.inquiries where id = $1", [
      created.rows[0].id,
    ]);
    const ownNotification = await database.query<{ count: number }>(
      "select count(*)::int as count from public.notifications where user_id = $1 and event_type = 'business_inquiry_response'",
      [customerId],
    );
    await database.exec("reset role");

    expect(ownInquiry.rows).toEqual([
      {
        status: "responded",
        response_message:
          "We are open until 9 PM. Please call before you visit.",
      },
    ]);
    expect(ownNotification.rows[0].count).toBe(1);
  });

  it("restricts the admin user directory and audits account status changes", async () => {
    const adminId = randomUUID();
    const customerId = randomUUID();
    const inactiveId = randomUUID();
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'directory-admin@example.in', $2), ($3, 'directory-customer@example.in', $4), ($5, 'directory-inactive@example.in', $6)",
      [
        adminId,
        { full_name: "Directory Admin" },
        customerId,
        { full_name: "Searchable Customer" },
        inactiveId,
        { full_name: "Inactive Customer" },
      ],
    );
    const superRole = await database.query<{ id: string }>(
      "select id from public.roles where slug = 'super_admin' and business_id is null",
    );
    await database.query(
      "insert into public.user_roles(user_id, role_id) values ($1, $2)",
      [adminId, superRole.rows[0].id],
    );
    await database.query(
      "update public.users set status = 'inactive' where id = $1",
      [inactiveId],
    );
    const issueStatusAuthorization = async (
      targetId: string,
      requestedValue: string,
      reason: string,
    ) => {
      const authorizationId = randomUUID();
      await database.exec("reset role");
      await database.exec("set role service_role");
      await database.query(
        `insert into public.admin_action_authorizations
          (id, user_id, action_key, target_id, requested_value, reason)
         values ($1, $2, 'user.status.change', $3, $4, $5)`,
        [authorizationId, adminId, targetId, requestedValue, reason],
      );
      await database.exec("reset role");
      await database.exec("set role authenticated");
      await database.query(
        "select set_config('request.jwt.claim.sub', $1, false)",
        [adminId],
      );
      return authorizationId;
    };

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [customerId],
    );
    await expect(
      database.query("select * from public.admin_list_users()"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      database.query("select public.admin_set_user_status($1)", [randomUUID()]),
    ).rejects.toThrow(/permission denied/i);
    await database.exec("reset role");

    await database.exec("set role authenticated");
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [adminId],
    );
    await expect(
      database.query("select * from public.admin_action_authorizations"),
    ).rejects.toThrow();
    const matches = await database.query<{
      user_id: string;
      email: string;
      account_type: string;
      user_status: string;
    }>(
      "select user_id, email, account_type, user_status from public.admin_list_users('searchable', null, 'active', 50, 0)",
    );
    expect(matches.rows).toEqual([
      {
        user_id: customerId,
        email: "directory-customer@example.in",
        account_type: "customer",
        user_status: "active",
      },
    ]);
    const inactiveUsers = await database.query<{ user_id: string }>(
      "select user_id from public.admin_list_users(null, null, 'inactive', 50, 0)",
    );
    expect(inactiveUsers.rows.map((row) => row.user_id)).toContain(inactiveId);
    await expect(
      database.query(
        "select * from public.admin_list_users(null, 'unexpected', null, 50, 0)",
      ),
    ).rejects.toThrow(/invalid user directory filter/i);
    await expect(
      database.query("select public.admin_set_user_status($1)", [randomUUID()]),
    ).rejects.toThrow(/missing or expired/i);
    const invalidReasonAuthorization = await issueStatusAuthorization(
      customerId,
      "suspended",
      "No",
    );
    await expect(
      database.query("select public.admin_set_user_status($1)", [
        invalidReasonAuthorization,
      ]),
    ).rejects.toThrow(/provide a reason/i);
    const authorizationId = await issueStatusAuthorization(
      customerId,
      "suspended",
      "Repeated abuse reports",
    );
    await database.query("select public.admin_set_user_status($1)", [
      authorizationId,
    ]);
    await expect(
      database.query("select public.admin_set_user_status($1)", [
        authorizationId,
      ]),
    ).rejects.toThrow(/missing or expired/i);
    const selfAuthorization = await issueStatusAuthorization(
      adminId,
      "active",
      "Cannot change self",
    );
    await expect(
      database.query("select public.admin_set_user_status($1)", [
        selfAuthorization,
      ]),
    ).rejects.toThrow(/cannot change their own/i);
    await database.exec("reset role");

    const status = await database.query<{ status: string }>(
      "select status from public.users where id = $1",
      [customerId],
    );
    const audit = await database.query<{
      action: string;
      previous_value: { status: string };
      new_value: { status: string };
      metadata: { reason: string };
    }>(
      "select action, previous_value, new_value, metadata from public.audit_logs where actor_user_id = $1 and record_id = $2",
      [adminId, customerId],
    );
    expect(status.rows[0].status).toBe("suspended");
    expect(audit.rows).toEqual([
      {
        action: "user.status_changed",
        previous_value: { status: "active" },
        new_value: { status: "suspended" },
        metadata: { reason: "Repeated abuse reports" },
      },
    ]);
    const grants = await database.query<{
      grantee: string;
      privilege_type: string;
    }>(
      `select grantee, privilege_type from information_schema.routine_privileges
       where routine_schema = 'public' and routine_name = 'admin_list_users'`,
    );
    expect(grants.rows).toContainEqual({
      grantee: "authenticated",
      privilege_type: "EXECUTE",
    });
    expect(grants.rows.some((grant) => grant.grantee === "anon")).toBe(false);
  });
});
