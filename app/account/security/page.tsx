import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { SecuritySettingsForms } from "@/components/security/security-settings-forms";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { hasRecentOtp } from "@/lib/security/security-pin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account security" };

type SearchParams = Promise<{ pin?: string; updated?: string }>;

interface SecurityRecoverySettings {
  recovery_email: string | null;
  recovery_phone_e164: string | null;
  has_security_pin: boolean;
  mfa_enabled: boolean;
}

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireAuthenticatedUser();
  const [params, settingsResult, claimsResult] = await Promise.all([
    searchParams,
    supabase.rpc("get_my_security_recovery_settings"),
    supabase.auth.getClaims(),
  ]);
  const settings = (
    (settingsResult.data ?? []) as SecurityRecoverySettings[]
  )[0];
  const otpRecent =
    !claimsResult.error &&
    hasRecentOtp(claimsResult.data?.claims as Record<string, unknown>);
  const resetPin = params.pin === "reset" && otpRecent;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">Account</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Public site</Link>
            </Button>
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Account protection
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Security settings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Set verified recovery methods and an optional PIN for sensitive
          account actions. Contact changes require your current password and
          administrators must complete MFA when it is enabled.
        </p>
        {settingsResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Security settings are temporarily unavailable. Refresh the page or
            contact support if this continues.
          </p>
        )}
        {params.pin === "reset" && !resetPin && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
          >
            Verify a fresh email or mobile code before resetting your security
            PIN.{" "}
            <Link href="/security/recover" className="font-semibold underline">
              Start recovery
            </Link>
          </p>
        )}
        {params.updated === "pin" && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-950"
          >
            Security PIN saved.
          </p>
        )}
        <SecuritySettingsForms
          email={user.email ?? null}
          phone={user.phone ?? null}
          emailVerified={Boolean(user.email_confirmed_at)}
          phoneVerified={Boolean(user.phone_confirmed_at)}
          recoveryEmail={settings?.recovery_email ?? null}
          recoveryPhone={settings?.recovery_phone_e164 ?? null}
          hasPin={settings?.has_security_pin ?? false}
          resetPin={resetPin}
        />
      </div>
    </main>
  );
}
