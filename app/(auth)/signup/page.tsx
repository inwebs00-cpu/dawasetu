import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return <SignupForm />;
}
