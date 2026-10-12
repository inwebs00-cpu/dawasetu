import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { listPublicDoctorBookingProfiles } from "@/services/doctor-booking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Doctor appointments",
  description:
    "Browse doctor profiles linked to their exact Click2Book appointment pages.",
};

export default async function DoctorsPage() {
  const directory = await listPublicDoctorBookingProfiles();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/medicines">Find medicine</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </header>
        <section>
          <p className="text-sm font-semibold text-teal-800">Appointments</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Doctor profiles
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Choose a profile to open its doctor-specific booking page on
            Click2Book. DawaSetu does not book or confirm appointments.
          </p>
        </section>
        <div className="mt-7">
          {directory.status === "unconfigured" ? (
            <EmptyState
              title="The doctor directory is not connected"
              description="Configure Supabase and apply the DawaSetu migrations to list published doctor profiles."
            />
          ) : directory.status === "error" ? (
            <EmptyState
              title="The doctor directory is temporarily unavailable"
              description="Please try again shortly."
            />
          ) : directory.profiles.length === 0 ? (
            <EmptyState
              title="No doctor profiles published yet"
              description="Profiles added by DawaSetu administrators will appear here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {directory.profiles.map((doctor) => (
                <article
                  key={doctor.doctor_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
                    {doctor.specialty}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {doctor.full_name}
                  </h2>
                  {doctor.business_name && (
                    <p className="mt-1 text-sm text-slate-600">
                      {doctor.business_name}
                    </p>
                  )}
                  <Button asChild className="mt-5">
                    <Link href={"/doctors/" + doctor.slug}>
                      View profile and booking
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
