import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { ChangeAdminPasswordCard } from "@/components/admin/change-admin-password-card";
import { SecurityMfaCard } from "@/components/admin/security-mfa-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security settings" };

export default async function AdminSecurityPage() {
  const { supabase } = await requirePlatformPermission("security.manage");
  const { data, error } = await supabase.auth.mfa.listFactors();
  const verifiedFactors = error
    ? []
    : data.totp
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          friendly_name: factor.friendly_name ?? null,
        }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/security">Recovery and PIN</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Account protection
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Security settings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Use a time-based code from an authenticator app to protect privileged
          admin operations. MFA state is audited and enforced by the database.
        </p>
        <SecurityMfaCard verifiedFactors={verifiedFactors} />
        <ChangeAdminPasswordCard />
        {error && (
          <Card className="mt-5 border-rose-200 bg-rose-50">
            <CardHeader>
              <CardTitle className="text-rose-950">
                Authenticator status unavailable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-rose-900">
              Refresh the page. If the problem continues, contact DawaSetu
              support before changing your security settings.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
