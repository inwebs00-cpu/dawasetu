import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact DawaSetu support" };

export default async function ContactPage() {
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
                    <Link href="/login">Sign in</Link>
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
