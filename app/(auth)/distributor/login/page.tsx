import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Distributor sign in" };

export default function DistributorLoginPage() {
  return <LoginForm portal="distributor" />;
}
