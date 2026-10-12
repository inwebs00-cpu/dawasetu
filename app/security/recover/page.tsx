import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { SecurityRecoveryForm } from "@/components/security/security-recovery-form";

export const metadata: Metadata = { title: "Reset security PIN" };

export default function RecoverSecurityPinPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e7f6f2,_#f8fafc_55%)] px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8">
        <Brand />
        <SecurityRecoveryForm />
      </div>
    </main>
  );
}
