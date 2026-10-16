import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminOtpLoginForm, LoginForm } from "@/components/auth/auth-form";
import { getSignedInDestination } from "@/lib/auth/signed-in-destination";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  method?: string | string[];
  error?: string | string[];
}>;

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
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage =
    error === "access"
      ? "This email signed in, but it is not assigned to the DawaSetu admin workspace. Ask an existing administrator to check its role."
      : error === "security"
        ? "We could not complete the security check. Please sign in again."
        : error === "link"
          ? "This sign-in link could not be verified. It may have expired or already been used. Request a new email and open it promptly; if it still fails, open it in the same browser where you requested it."
          : null;

  return (
    <div className="w-full max-w-md">
      {errorMessage && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
        >
          {errorMessage}
        </p>
      )}
      {method === "password" ? (
        <LoginForm portal="admin" />
      ) : (
        <AdminOtpLoginForm />
      )}
    </div>
  );
}
