import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/auth-form";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set your new password" };

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath =
    getSafeNextPath(
      Array.isArray(params.next) ? params.next[0] : params.next,
    ) ?? "/account";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(`/change-password?next=${nextPath}`)}`,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("password_change_required")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) redirect("/login");
  if (!profile.password_change_required) redirect(nextPath);

  return <UpdatePasswordForm firstLogin nextPath={nextPath} />;
}
