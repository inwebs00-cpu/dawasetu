import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Pharmacy and clinic sign in" };

export default function PartnerLoginPage() {
  return <LoginForm portal="partner" />;
}
