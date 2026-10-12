import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
