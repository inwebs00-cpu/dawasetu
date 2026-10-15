"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const publicRoutes = [
  "/",
  "/about",
  "/contact",
  "/blog",
  "/medicines",
  "/pharmacies",
  "/doctors",
  "/privacy",
  "/terms",
  "/refund-cancellation",
];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) =>
      pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (!isPublicRoute(pathname)) return null;

  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 text-sm text-slate-600 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            DawaSetu · India’s Medicine Availability Network
          </p>
          <p className="mt-1 text-xs">
            Find medicines. Find nearby. Availability is reported by partners.
          </p>
        </div>
        <nav
          aria-label="Legal and company information"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
        >
          <Link className="hover:text-teal-800" href="/about">
            About us
          </Link>
          <Link className="hover:text-teal-800" href="/contact">
            Contact
          </Link>
          <Link className="hover:text-teal-800" href="/privacy">
            Privacy policy
          </Link>
          <Link className="hover:text-teal-800" href="/terms">
            Terms &amp; conditions
          </Link>
          <Link className="hover:text-teal-800" href="/refund-cancellation">
            Refund &amp; cancellation
          </Link>
        </nav>
      </div>
    </footer>
  );
}
