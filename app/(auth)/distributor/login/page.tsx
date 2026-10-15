import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-form";
import { getSignedInDestination } from "@/lib/auth/signed-in-destination";

export const metadata: Metadata = { title: "Distributor sign in" };
export const dynamic = "force-dynamic";

export default async function DistributorLoginPage() {
  const destination = await getSignedInDestination("distributor");
  if (destination) redirect(destination);
  return <LoginForm portal="distributor" />;
}
