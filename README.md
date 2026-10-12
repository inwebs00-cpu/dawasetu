# DawaSetu

DawaSetu is an India-focused medicine availability discovery network. It helps people find local
pharmacies and helps verified partner businesses coordinate availability. Distributor inventory
is private to authorized businesses.

## Technology

- Next.js App Router and TypeScript
- Tailwind CSS 4 with shadcn/ui-compatible configuration
- Supabase PostgreSQL, Auth, Storage, and Realtime
- Vercel deployment

## Local setup

1. Install Node.js 20.19 or newer.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix. Current user
workflows use the signed-in Supabase client and permission-checked database functions; do not use the
service-role client for ordinary user requests.

## Supabase setup

1. Create a Supabase project and configure its Auth email templates and redirect URLs. Include
   `http://localhost:3000/auth/callback` locally and the production `/auth/callback` URL.
   The local Supabase config sets a 30-minute inactivity timeout and a 24-hour session timebox;
   apply the same limits in the hosted project's Auth → Sessions settings. Hosted Supabase enforces
   these limits when sessions refresh, so use a plan that supports session timeouts.
   For security-PIN recovery, configure the email OTP template to display Supabase's numeric token.
   Enable Phone Auth and configure an SMS provider if mobile recovery is required; set suitable OTP
   rate limits and CAPTCHA for the hosted project.
2. Apply every SQL file in `supabase/migrations/` in timestamp order using the Supabase CLI or SQL
   editor. The migrations install RLS, permission checks, search, customer requests, partner
   onboarding, medicine reviews, geographic areas, distributor B2B access, customer account
   features, subscriptions and payments, public content, and auditable administrative changes.
3. Create the first platform administrator from the trusted SQL editor. Replace the email with an
   already verified Supabase Auth account:

   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id
   from auth.users u
   join public.roles r on r.slug = 'super_admin' and r.business_id is null
   where lower(u.email) = lower('admin@example.in')
   on conflict do nothing;

   update public.users
   set account_type = 'super_admin'
   where id = (select id from auth.users where lower(email) = lower('admin@example.in'));
   ```

   Do not expose a self-service admin role assignment in the application.

4. Add active areas under **Admin → Network locations**. Customer requests are routed only to
   approved partner businesses mapped to the same area. Start with the locations where the network
   has verified partners.
5. Enable Supabase Cron and schedule `public.expire_stale_medicine_requests()` every few minutes so
   expired requests receive the `expired` status. Until Cron is enabled, request RPCs and pages still
   stop routing requests at their stored 24-hour expiry.
6. Schedule `public.expire_stale_subscriptions()` daily using Supabase Cron so expired trials and
   paid periods transition to `expired`. It is service-role-only and must run as a trusted database
   job.
7. Configure Razorpay test or live credentials in the server environment. Set the webhook URL to
   `https://<your-domain>/api/webhooks/razorpay`, subscribe it to `payment.captured`,
   `payment.failed`, and `refund.processed`, and use the same webhook secret in
   `RAZORPAY_WEBHOOK_SECRET`. Test order
   creation, checkout, signature verification, capture, and webhook delivery in Razorpay test mode
   before enabling live credentials. Checkout stays disabled until all three Razorpay values are
   configured.
8. The Click2Book homepage link is included in `supabase/seed/redirect-websites.sql`. It is safe to
   re-run; change its URL, label, or active status in **Admin → Redirect websites** after the
   initial seed.

## Implemented workflows

- Customer signup, sign-in, email confirmation, and password recovery through Supabase Auth.
- Public search for approved medicines and reported stock at approved public pharmacies, clinics,
  and nursing-home pharmacies. Public RPC responses exclude distributor stock and quantity.
- Partner registration, partner review, business profile and visibility settings, inventory updates,
  medicine submissions, area-matched medicine requests, and private verification-document upload
  with reviewer decisions and short-lived download links.
- Customer availability requests with database-enforced rate limits and expiry, approximate-area
  disclosure to partners, and in-app response notifications.
- Admin medicine master CRUD/review, partner approval/suspension, business onboarding, area
  configuration, and a permission-checked audit log for administrative, profile, and inventory
  changes.
- Support ticket triage with permission-checked status/priority updates, eligible-team assignment, public
  replies, private internal notes, and requester-safe message visibility.
- Customer support inbox with private ticket history and replies, PDF/JPEG/PNG attachments in a
  private, row-level-secured storage bucket, short-lived download links, closed-ticket enforcement,
  per-ticket reply rate limits, assignment notifications, and public/internal message isolation.
- Customer profile editing, per-account saved medicines and recent search history, plus private
  in-app notifications with read-state controls and user-scoped Realtime delivery.
- Platform team and custom-role administration with password re-authentication for sensitive
  changes, permission-subset enforcement, and audited role/status updates.
- Optional administrator TOTP enrollment, sign-in challenge, audited MFA state, and database-level
  AAL2 enforcement for privileged permissions after MFA is enabled.
- Per-user verified recovery email/mobile selection, Supabase Auth OTP recovery, salted scrypt
  security PIN setup/reset, finance/admin MFA checks, five-attempt lockout, and audit events without
  recording PIN values or hashes in the audit log.
- Partner and admin analytics over real requests, inventory, inquiries, orders, locations, and paid
  payments, plus daily unique profile/search events recorded with keyed visitor hashes rather than
  stored IP addresses.
- Finance-controlled subscription plan CRUD with INR price, limit, trial, and feature configuration;
  plans with subscription history cannot be deleted.
- Razorpay one-time checkout orders, server-side signature and captured-payment verification,
  signature-checked idempotent webhooks, subscription trials and expiry, payment history, and
  owner/finance-authorized printable payment receipts.
- Finance-only Razorpay full or partial refund requests with current-password confirmation, reserved
  refundable balances, signed `refund.processed` webhook reconciliation, and audited payment totals.
- Admin redirect website CRUD with HTTPS URL validation and audit history, plus an active
  Click2Book external appointment link on the customer homepage.
- Admin-managed doctor appointment profiles with exact Click2Book deep links, approved clinic or
  nursing-home association, public directory/profile pages, and sitemap entries.
- Public medicine detail links with same-composition catalog entries filtered to approved,
  publicly visible products. The UI explicitly leaves substitution decisions to clinicians.
- Admin-controlled partner offers, featured placements, and sponsored listings with dated status
  windows, audit history, and clearly labelled public display on eligible partner profiles;
  approved retail, clinic, and nursing-home partners can submit and resubmit requests, but cannot
  approve their own placements.
- Seeded medicine categories with content-manager CRUD, safe deactivation, medicine usage counts,
  audit records, and database-backed public category browsing.
- Customer-submitted partner reviews with pending moderation, anonymous public display, owner/team
  self-review prevention, admin decisions, notifications, and audit history.
- Distributor access requests and private inventory search for verified partners after distributor
  approval. Distributor inventory is not readable from direct client table queries or public search.

Plans currently renew manually; automated recurring billing, GST tax invoices, and provider
email/SMS/WhatsApp notifications still need implementation.
The 30-minute inactivity timeout is configured for local Supabase and must be set in the hosted
project's Auth → Sessions settings; it is not editable from the application admin panel.
Receipts are payment records and are not GST tax invoices. No live payment transaction has been
verified because merchant credentials and a configured webhook are deployment-specific.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run format:check`
- `npm run build`

## Deployment

Import the GitHub repository into Vercel and configure environment variables in the project settings.
Set `NEXT_PUBLIC_SITE_URL` to the production HTTPS origin and configure the same origin in Supabase
Auth redirect URLs. Apply Supabase migrations before enabling database-backed features. Keep local
`.env.local` files and all secret keys out of source control.

## Phased implementation

The project is being built in reviewed phases. Each completed database slice is validated with
PGlite migration and RLS tests plus TypeScript, lint, formatting, and production-build checks. A
Supabase project and Vercel deployment still need to be configured before remote production
behavior can be verified.
