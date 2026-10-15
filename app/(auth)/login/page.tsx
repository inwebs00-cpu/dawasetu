import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-form";
import { getSignedInDestination } from "@/lib/auth/signed-in-destination";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(
    Array.isArray(params.next) ? params.next[0] : params.next,
  );
  const destination = await getSignedInDestination("customer");
  if (destination) redirect(nextPath ?? destination);
  return <LoginForm portal="customer" nextPath={nextPath ?? undefined} />;
}
