import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return <UpdatePasswordForm />;
}
