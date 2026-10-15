import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PwaInstallPrompt } from "@/components/pwa/install-prompt";
import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DawaSetu — India’s Medicine Availability Network",
    template: "%s | DawaSetu",
  },
  description: "Find medicines. Find nearby.",
  applicationName: "DawaSetu",
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
          <PwaInstallPrompt />
        </ToastProvider>
      </body>
    </html>
  );
}
