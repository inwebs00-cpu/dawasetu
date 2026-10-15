import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return <LoginForm portal="admin" />;
}
