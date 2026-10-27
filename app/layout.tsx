import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PwaInstallPrompt } from "@/components/pwa/install-prompt";
import { OfficialSiteNotice } from "@/components/layout/official-site-notice";
import { SiteFooter } from "@/components/layout/site-footer";
import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app",
  ),
  title: {
    default: "DawaSetu — India’s Medicine Availability Network",
    template: "%s | DawaSetu",
  },
  description: "Find medicines. Find nearby.",
  applicationName: "DawaSetu",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "DawaSetu",
    title: "DawaSetu — India’s Medicine Availability Network",
    description:
      "Search medicines and check partner-reported availability at nearby pharmacies in India.",
  },
  twitter: {
    card: "summary",
    title: "DawaSetu — India’s Medicine Availability Network",
    description:
      "Find medicines and check nearby pharmacy availability across India.",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f7fbfa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <ToastProvider>
          {children}
          <OfficialSiteNotice />
          <PwaInstallPrompt />
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
