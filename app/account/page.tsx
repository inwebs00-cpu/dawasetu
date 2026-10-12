import Link from "next/link";

import { NotificationRealtime } from "@/components/account/notification-realtime";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { signOutAction } from "@/app/(auth)/actions";
import {
  markNotificationsReadAction,
  removeSavedMedicineAction,
  updateAccountProfileAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  request?: string;
  profile?: string;
  profile_error?: string;
  saved?: string;
  saved_error?: string;
  notifications?: string;
  notifications_error?: string;
}>;

interface CustomerRequest {
  request_id: string;
  medicine_id: string | null;
  requested_medicine_name: string;
  composition_text: string | null;
  strength: string | null;
  quantity: number;
  approximate_area: string | null;
  contact_preference: string;
  status: string;
  created_at: string;
  expires_at: string;
  business_id: string | null;
  business_name: string | null;
  business_phone: string | null;
  business_whatsapp: string | null;
  business_address: string | null;
  business_latitude: number | null;
  business_longitude: number | null;
  response_message: string | null;
}

interface BusinessAccess {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
}

interface SavedMedicine {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  saved_at: string;
}

interface RecentSearch {
  query_text: string;
  search_count: number;
  last_searched_at: string;
}

interface AccountNotification {
  id: string;
  title: string;
  body: string;
  event_type: string;
  read_at: string | null;
  created_at: string;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile, supabase, user } = await requireAuthenticatedUser();
  const params = await searchParams;
  const [
    requestResult,
    businessesResult,
    adminResult,
    savedResult,
    recentSearchResult,
    notificationResult,
  ] = await Promise.all([
    supabase.rpc("list_my_medicine_requests"),
    supabase.rpc("list_my_businesses"),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "dashboard.view",
    }),
    supabase.rpc("list_my_saved_medicines"),
    supabase.rpc("list_my_recent_medicine_searches", { p_limit: 10 }),
    supabase
      .from("notifications")
      .select("id, title, body, event_type, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const requests = (
    requestResult.error ? [] : (requestResult.data ?? [])
  ) as CustomerRequest[];
  const businesses = (businessesResult.data ?? []) as BusinessAccess[];
  const savedMedicines = (savedResult.data ?? []) as SavedMedicine[];
  const recentSearches = (recentSearchResult.data ?? []) as RecentSearch[];
  const notifications = (notificationResult.data ??
    []) as AccountNotification[];
  const unreadNotifications = notifications.some((item) => !item.read_at);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <NotificationRealtime userId={user.id} />
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/support">Support tickets</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/security">Security</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Public site</Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <section className="mt-8 rounded-3xl bg-[linear-gradient(120deg,_#0f5557_0%,_#13876e_100%)] p-6 text-white shadow-sm sm:p-9">
          <p className="text-sm font-medium text-teal-50">DawaSetu account</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Welcome, {profile.full_name}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50">
                Search nearby availability, review your medicine requests, and
                contact a partner when they report that they may have it.
              </p>
            </div>
            <StatusBadge status={profile.status} />
          </div>
        </section>

        {params.request === "sent" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
          >
            Your medicine availability request was sent to eligible partners in
            your area.
          </p>
        )}
        {params.profile === "updated" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
          >
            Your profile was updated.
          </p>
        )}
        {params.profile_error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            Profile changes could not be saved. Use an international phone
            number such as +919876543210 and check the other fields.
          </p>
        )}
        {params.saved === "removed" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
          >
            Saved medicine removed.
          </p>
        )}
        {params.saved_error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            The saved medicine could not be removed. Refresh and try again.
          </p>
        )}
        {params.notifications === "read" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
          >
            Notifications marked as read.
          </p>
        )}
        {params.notifications_error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            Notifications could not be marked as read.
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-sm font-medium text-teal-800">Personal details</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as {user.email ?? "verified account"}.
          </p>
          <form
            action={updateAccountProfileAction}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Full name
              <input
                name="full_name"
                required
                minLength={1}
                maxLength={160}
                defaultValue={profile.full_name}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Mobile number
              <input
                name="phone_e164"
                type="tel"
                inputMode="tel"
                pattern="\\+[1-9][0-9]{7,14}"
                maxLength={16}
                defaultValue={profile.phone_e164 ?? ""}
                placeholder="+919876543210"
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Preferred language
              <input
                name="preferred_language"
                required
                minLength={2}
                maxLength={12}
                defaultValue={profile.preferred_language}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-teal-800">Updates</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Notifications
              </h2>
            </div>
            {unreadNotifications && (
              <form action={markNotificationsReadAction}>
                <Button type="submit" size="sm" variant="outline">
                  Mark all read
                </Button>
              </form>
            )}
          </div>
          {notificationResult.error ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
              Notifications are temporarily unavailable.
            </p>
          ) : notifications.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No notifications yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className={`py-3 ${item.read_at ? "" : "border-l-2 border-teal-600 pl-3"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-teal-800">Your list</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Saved medicines
            </h2>
            {savedResult.error ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                Saved medicines are temporarily unavailable.
              </p>
            ) : savedMedicines.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Save a medicine from search results to keep it here.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {savedMedicines.map((medicine) => (
                  <article
                    key={medicine.medicine_id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div>
                      <h3 className="font-medium text-slate-950">
                        {medicine.product_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {medicine.composition ?? "Composition not listed"} ·{" "}
                        {medicine.strength}
                      </p>
                      {medicine.manufacturer_name && (
                        <p className="mt-1 text-xs text-slate-500">
                          {medicine.manufacturer_name}
                        </p>
                      )}
                      <Link
                        className="mt-2 inline-block text-sm font-medium text-teal-800 underline"
                        href={`/medicines?q=${encodeURIComponent(medicine.product_name)}`}
                      >
                        Check availability
                      </Link>
                    </div>
                    <form action={removeSavedMedicineAction}>
                      <input
                        type="hidden"
                        name="medicine_id"
                        value={medicine.medicine_id}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Remove
                      </Button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-teal-800">Search history</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Recent medicine searches
            </h2>
            {recentSearchResult.error ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                Recent searches are temporarily unavailable.
              </p>
            ) : recentSearches.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Signed-in medicine searches will appear here.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {recentSearches.map((search) => (
                  <div
                    key={search.query_text}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <Link
                      className="font-medium text-teal-800 underline"
                      href={`/medicines?q=${encodeURIComponent(search.query_text)}`}
                    >
                      {search.query_text}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {search.search_count} searches ·{" "}
                      {new Date(search.last_searched_at).toLocaleDateString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {(adminResult.data === true || businesses.length > 0) && (
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {adminResult.data === true && (
              <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-sm font-medium text-teal-800">
                  Platform team
                </p>
                <h2 className="mt-1 font-semibold text-slate-950">
                  Admin workspace
                </h2>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/admin">Open admin dashboard</Link>
                </Button>
              </article>
            )}
            {businesses.map((business) => {
              const isDistributor = business.business_type
                .toLowerCase()
                .includes("distributor");
              const href = isDistributor
                ? `/distributor/${business.business_id}`
                : `/partner/${business.business_id}`;
              return (
                <article
                  key={business.business_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-teal-800">
                        {business.business_type}
                      </p>
                      <h2 className="mt-1 font-semibold text-slate-950">
                        {business.business_name}
                      </h2>
                    </div>
                    <StatusBadge status={business.business_status} />
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={href}>
                      {isDistributor
                        ? "Distributor dashboard"
                        : "Partner dashboard"}
                    </Link>
                  </Button>
                </article>
              );
            })}
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-teal-800">Your activity</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Medicine requests
              </h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/medicines">Find a medicine</Link>
            </Button>
          </div>
          {requestResult.error ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Request history is temporarily unavailable.
            </p>
          ) : requests.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              You haven’t sent a medicine request yet. Search the network or
              request an item that isn’t currently listed.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {requests.map((request) => {
                const directionsUrl =
                  request.business_latitude !== null &&
                  request.business_longitude !== null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${request.business_latitude},${request.business_longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${request.business_name ?? "pharmacy"} ${request.business_address ?? ""}`)}`;
                const whatsapp = request.business_whatsapp?.replace(
                  /[^0-9]/g,
                  "",
                );
                return (
                  <article
                    key={`${request.request_id}:${request.business_id ?? "waiting"}`}
                    className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">
                          {request.requested_medicine_name}
                        </h3>
                        <StatusBadge
                          status={
                            request.business_name ? "available" : request.status
                          }
                        />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.composition_text ?? "Composition not supplied"}
                        {request.strength ? ` · ${request.strength}` : ""} ·
                        Quantity {request.quantity}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.approximate_area
                          ? `Area: ${request.approximate_area} · `
                          : ""}
                        Requested{" "}
                        {new Date(request.created_at).toLocaleDateString(
                          "en-IN",
                        )}
                        {request.status === "expired"
                          ? " · Request expired"
                          : ""}
                      </p>
                      {request.business_name && (
                        <div className="mt-3 rounded-xl bg-teal-50 p-3">
                          <p className="font-medium text-teal-950">
                            {request.business_name} may have this medicine
                          </p>
                          {request.response_message && (
                            <p className="mt-1 text-sm text-teal-900">
                              {request.response_message}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {request.business_phone && (
                              <Button asChild size="sm" variant="secondary">
                                <a href={`tel:${request.business_phone}`}>
                                  Call pharmacy
                                </a>
                              </Button>
                            )}
                            {whatsapp && (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={`https://wa.me/${whatsapp}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  WhatsApp
                                </a>
                              </Button>
                            )}
                            <Button asChild size="sm" variant="ghost">
                              <a
                                href={directionsUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Directions
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="self-start text-xs text-slate-500">
                      Expires{" "}
                      {new Date(request.expires_at).toLocaleDateString("en-IN")}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-teal-800">Account access</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {profile.account_type.replaceAll("_", " ")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Access is assigned by DawaSetu after verification. Creating a
              customer login does not grant partner or distributor inventory
              access.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-teal-800">
              For local businesses
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Join the availability network
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Partner registration includes a business review before public
              listings or inventory can be enabled.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/partner/register">Register a business</Link>
            </Button>
          </article>
        </section>
      </div>
    </main>
  );
}
