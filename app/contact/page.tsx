import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";
import { getPublicBusinessDetails } from "@/lib/site/public-business-details";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contact DawaSetu support",
  description:
    "Contact DawaSetu about medicine availability, pharmacy onboarding, subscriptions, payments, privacy or support in India.",
  keywords: [
    "contact DawaSetu",
    "DawaSetu customer support",
    "DawaSetu payment support",
    "DawaSetu grievance officer",
  ],
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact DawaSetu support",
    description:
      "Get support for DawaSetu accounts, partners, payments and privacy requests.",
    url: "/contact",
    type: "website",
  },
};

export default async function ContactPage() {
  const details = getPublicBusinessDetails();
  let signedIn = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch {
      signedIn = false;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Contact</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          How can we help?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Send a support request about your account, partner onboarding,
          availability data, or a privacy concern. A ticket is visible only to
          you and authorized support staff.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Read the{" "}
          <Link
            className="font-medium text-teal-800 underline underline-offset-2"
            href="/privacy"
          >
            DawaSetu Privacy Policy
          </Link>{" "}
          to learn how account, search, location and support information is
          handled.
        </p>
        <section
          aria-labelledby="business-contact-heading"
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2
            id="business-contact-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Business and payment contact
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {details.legalName && (
              <div>
                <dt className="text-slate-500">Legal business name</dt>
                <dd className="font-medium text-slate-900">
                  {details.legalName}
                </dd>
              </div>
            )}
            {details.address && (
              <div>
                <dt className="text-slate-500">Operating address</dt>
                <dd className="font-medium text-slate-900">
                  {details.address}
                </dd>
              </div>
            )}
            {details.supportEmail && (
              <div>
                <dt className="text-slate-500">Support email</dt>
                <dd>
                  <a
                    className="font-medium text-teal-800 underline"
                    href={`mailto:${details.supportEmail}`}
                  >
                    {details.supportEmail}
                  </a>
                </dd>
              </div>
            )}
            {details.supportPhone && (
              <div>
                <dt className="text-slate-500">Support phone</dt>
                <dd>
                  <a
                    className="font-medium text-teal-800 underline"
                    href={`tel:${details.supportPhone.replace(/[^+\d]/g, "")}`}
                  >
                    {details.supportPhone}
                  </a>
                </dd>
              </div>
            )}
            {details.supportHours && (
              <div>
                <dt className="text-slate-500">Support hours</dt>
                <dd className="font-medium text-slate-900">
                  {details.supportHours}
                </dd>
              </div>
            )}
          </dl>
          {(details.grievanceName ||
            details.grievanceEmail ||
            details.grievancePhone) && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-slate-900">
                Grievance officer
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {details.grievanceName || ""}
                {details.grievanceEmail ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      className="text-teal-800 underline"
                      href={`mailto:${details.grievanceEmail}`}
                    >
                      {details.grievanceEmail}
                    </a>
                  </>
                ) : null}
                {details.grievancePhone ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      className="text-teal-800 underline"
                      href={`tel:${details.grievancePhone.replace(/[^+\d]/g, "")}`}
                    >
                      {details.grievancePhone}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </section>
        <Card className="mt-7">
          <CardHeader>
            <CardTitle>Create a support ticket</CardTitle>
          </CardHeader>
          <CardContent>
            {signedIn ? (
              <SupportTicketForm />
            ) : (
              <div className="rounded-xl bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-700">
                  Sign in to submit a private support ticket. You can create a
                  customer account if you have not registered yet.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/account">Account</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/signup">Create account</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
