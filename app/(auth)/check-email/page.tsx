import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(15,76,78,0.35)] sm:p-8">
      <p className="text-sm font-semibold text-teal-800">Email verification</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        Check your inbox
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        If the address is eligible for registration, Supabase will send a
        verification link. Open it on this device to finish setting up your
        account.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link href="/login">Continue to sign in</Link>
      </Button>
    </section>
  );
}
