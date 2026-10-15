import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-form";
import { getSignedInDestination } from "@/lib/auth/signed-in-destination";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const destination = await getSignedInDestination("admin");
  if (destination) redirect(destination);
  return <LoginForm portal="admin" />;
}
