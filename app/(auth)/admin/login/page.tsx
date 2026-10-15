import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminOtpLoginForm, LoginForm } from "@/components/auth/auth-form";
import { getSignedInDestination } from "@/lib/auth/signed-in-destination";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ method?: string | string[] }>;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const destination = await getSignedInDestination("admin");
  if (destination) redirect(destination);
  const params = await searchParams;
  const method = Array.isArray(params.method)
    ? params.method[0]
    : params.method;
  return method === "password" ? (
    <LoginForm portal="admin" />
  ) : (
    <AdminOtpLoginForm />
  );
}
