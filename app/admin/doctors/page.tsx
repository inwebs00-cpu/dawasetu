import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import {
  deleteDoctorBookingProfileAction,
  saveDoctorBookingProfileAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Doctor booking profiles" };

interface DoctorProfile {
  doctor_id: string;
  business_id: string | null;
  business_name: string | null;
  full_name: string;
  slug: string;
  specialty: string;
  description: string | null;
  booking_url: string;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

interface BusinessOption {
  id: string;
  business_name: string;
}

type SearchParams = Promise<{ updated?: string; error?: string }>;

function DoctorProfileForm({
  doctor,
  businesses,
}: {
  doctor?: DoctorProfile;
  businesses: BusinessOption[];
}) {
  return (
    <form action={saveDoctorBookingProfileAction} className="grid gap-4">
      <input type="hidden" name="doctor_id" value={doctor?.doctor_id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Doctor name
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={doctor?.full_name}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Profile slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={180}
            defaultValue={doctor?.slug}
            placeholder="dr-anita-sharma"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Specialty
          <input
            name="specialty"
            required
            minLength={2}
            maxLength={120}
            defaultValue={doctor?.specialty}
            placeholder="Cardiology"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Approved clinic or nursing home
          <select
            name="business_id"
            defaultValue={doctor?.business_id ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          >
            <option value="">No linked DawaSetu business</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.business_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
          Click2Book doctor booking URL
          <input
            type="url"
            name="booking_url"
            required
            maxLength={2048}
            pattern="https://.*click2book\.in/.*"
            defaultValue={doctor?.booking_url}
            placeholder="https://click2book.in/doctor/profile"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
          <span className="font-normal text-slate-500">
            Use the exact doctor-specific URL supplied by Click2Book.
          </span>
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Description
        <textarea
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={doctor?.description ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Display order
          <input
            type="number"
            name="display_order"
            required
            min="0"
            max="10000"
            defaultValue={doctor?.display_order ?? 0}
            className="h-10 w-28 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={doctor?.is_active ?? false}
            className="size-4 accent-teal-700"
          />
          Publish doctor profile
        </label>
        <Button type="submit" size="sm">
          {doctor ? "Save profile" : "Add profile"}
        </Button>
      </div>
    </form>
  );
}

export default async function AdminDoctorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, context] = await Promise.all([
    searchParams,
    requirePlatformPermission("content.manage"),
  ]);
  const [profilesResult, businessResult] = await Promise.all([
    context.supabase.rpc("admin_list_doctor_booking_profiles"),
    Promise.all([
      context.supabase.rpc("admin_list_businesses", {
        p_status: "approved",
        p_business_type_slug: "clinic_pharmacy",
        p_limit: 100,
        p_offset: 0,
      }),
      context.supabase.rpc("admin_list_businesses", {
        p_status: "approved",
        p_business_type_slug: "nursing_home_pharmacy",
        p_limit: 100,
        p_offset: 0,
      }),
    ]),
  ]);
  const profiles = (profilesResult.data ?? []) as DoctorProfile[];
  const businessError = businessResult.some((result) => result.error);
  const businesses = businessResult
    .flatMap((result) => result.data ?? [])
    .map((business) => ({
      id: business.business_id,
      business_name: business.business_name,
    })) as BusinessOption[];
  businesses.sort((a, b) => a.business_name.localeCompare(b.business_name));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          External appointments
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Doctor booking profiles
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Publish approved doctor profiles with their exact Click2Book booking
          URL. DawaSetu links customers to Click2Book and does not book or
          confirm appointments.
        </p>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {params.updated === "deleted"
              ? "Doctor profile deleted."
              : "Doctor profile saved."}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            The profile could not be saved. Check its details and Click2Book
            URL.
          </p>
        )}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Add a doctor
          </h2>
          <DoctorProfileForm businesses={businesses} />
        </section>
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Doctor directory
          </h2>
          {profilesResult.error || businessError ? (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
            >
              Doctor profiles are temporarily unavailable.
            </p>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No doctor profiles have been added.
            </div>
          ) : (
            <div className="grid gap-4">
              {profiles.map((doctor) => (
                <article
                  key={doctor.doctor_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {doctor.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {doctor.specialty}
                        {doctor.business_name
                          ? " · " + doctor.business_name
                          : ""}
                        {" · "}
                        <Link
                          className="font-medium text-teal-800 hover:underline"
                          href={"/doctors/" + doctor.slug}
                          target="_blank"
                        >
                          Preview
                        </Link>
                      </p>
                    </div>
                    <StatusBadge
                      status={doctor.is_active ? "active" : "inactive"}
                    />
                  </div>
                  <DoctorProfileForm doctor={doctor} businesses={businesses} />
                  <form
                    action={deleteDoctorBookingProfileAction}
                    className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4"
                  >
                    <input
                      type="hidden"
                      name="doctor_id"
                      value={doctor.doctor_id}
                    />
                    <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                      <input
                        name="confirm_delete"
                        type="checkbox"
                        value="yes"
                        required
                        className="mt-1 size-4 accent-rose-700"
                      />
                      Permanently delete this doctor profile and booking link.
                    </label>
                    <Button type="submit" size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
        <div className="mt-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/doctors">View public directory</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
