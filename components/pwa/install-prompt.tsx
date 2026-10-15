"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const dismissalKey = "dawasetu-install-prompt-dismissed-at";
const dismissalWindowMs = 7 * 24 * 60 * 60 * 1000;

function isPublicPage(pathname: string) {
  return [
    "/",
    "/medicines",
    "/pharmacies",
    "/about",
    "/blog",
    "/contact",
    "/doctors",
  ].some(
    (route) =>
      pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [isAppleMobile, setIsAppleMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!isPublicPage(pathname) || isStandalone()) return;

    const userAgent = navigator.userAgent;
    setIsAppleMobile(
      /iPhone|iPad|iPod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem(dismissalKey) ?? 0);
    } catch {
      dismissedAt = 0;
    }
    if (Date.now() - dismissedAt >= dismissalWindowMs) {
      const timer = window.setTimeout(() => setVisible(true), 1800);
      const onBeforeInstallPrompt = (event: Event) => {
        event.preventDefault();
        setDeferredPrompt(event as BeforeInstallPromptEvent);
        setVisible(true);
      };
      const onInstalled = () => setVisible(false);

      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.addEventListener("appinstalled", onInstalled);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(
          "beforeinstallprompt",
          onBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", onInstalled);
      };
    }
  }, [pathname]);

  function dismissPrompt() {
    setVisible(false);
    try {
      window.localStorage.setItem(dismissalKey, String(Date.now()));
    } catch {
      // Keep dismissal functional for this page even when storage is blocked.
    }
  }

  async function installApp() {
    if (!deferredPrompt) {
      setShowInstructions((current) => !current);
      return;
    }

    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    else setShowInstructions(true);
  }

  if (!visible || !isPublicPage(pathname)) return null;

  return (
    <aside
      aria-label="Install DawaSetu"
      className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-teal-100 bg-white p-3.5 shadow-[0_20px_60px_-24px_rgba(15,70,69,0.45)] sm:right-5 sm:bottom-5 sm:p-4"
      role="region"
    >
      <button
        aria-label="Dismiss install prompt"
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        onClick={dismissPrompt}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-7">
        <Image
          alt=""
          className="size-12 shrink-0 rounded-xl border border-slate-100 object-cover"
          height={48}
          src="/pwa-192.png"
          width={48}
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Get DawaSetu app</p>
          <p className="mt-0.5 text-xs leading-4 text-slate-600">
            Find nearby medicine availability from your home screen.
          </p>
        </div>
      </div>
      <button
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        onClick={installApp}
        type="button"
      >
        <Download aria-hidden="true" className="size-4" />
        Install app
      </button>
      {showInstructions && (
        <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2.5 text-xs leading-5 text-teal-950">
          {isAppleMobile
            ? "In Safari, tap Share, then choose Add to Home Screen."
            : "Open your browser menu and choose Install app or Add to Home screen."}
        </p>
      )}
    </aside>
  );
}
