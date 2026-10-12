import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { getPublicDoctorBookingProfile } from "@/services/doctor-booking";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ slug: string }>;

async function doctorFor(params: PageParams) {
  const { slug } = await params;
  return getPublicDoctorBookingProfile(slug);
}

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const doctor = await doctorFor(params);
  if (!doctor) return { title: "Doctor profile" };
  return {
    title: doctor.full_name + " · " + doctor.specialty,
    description:
      doctor.description ??
      doctor.full_name + " · " + doctor.specialty + " appointment booking.",
    openGraph: {
      title: doctor.full_name + " · " + doctor.specialty,
      description:
        doctor.description ??
        "Open this doctor's appointment page on Click2Book.",
      type: "profile",
    },
  };
}

export default async function DoctorBookingProfilePage({
  params,
}: {
  params: PageParams;
}) {
  const doctor = await doctorFor(params);
  if (!doctor?.booking_url) notFound();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/doctors">Doctor directory</Link>
          </Button>
        </header>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold text-teal-800">Doctor profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {doctor.full_name}
          </h1>
          <p className="mt-2 text-lg text-slate-700">{doctor.specialty}</p>
          {doctor.business_name && (
            <p className="mt-2 text-sm text-slate-600">
              {doctor.business_slug ? (
                <Link
                  className="font-medium text-teal-800 hover:underline"
                  href={"/pharmacies/" + doctor.business_slug}
                >
                  {doctor.business_name}
                </Link>
              ) : (
                doctor.business_name
              )}
            </p>
          )}
          {doctor.description && (
            <p className="mt-6 text-sm leading-7 whitespace-pre-wrap text-slate-700">
              {doctor.description}
            </p>
          )}
          <div className="mt-8 rounded-2xl bg-sky-50 p-5">
            <p className="text-sm leading-6 text-sky-950">
              Appointment details and booking are handled by Click2Book.
              DawaSetu does not confirm appointment availability.
            </p>
            <Button asChild className="mt-4">
              <a
                href={doctor.booking_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Book doctor appointment
              </a>
            </Button>
          </div>
        </article>
      </div>
    </main>
  );
}
