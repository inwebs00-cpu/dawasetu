import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { getPublicBusinessDetails } from "@/lib/site/public-business-details";

export const metadata: Metadata = {
  title: "About DawaSetu",
  description:
    "Learn how DawaSetu helps people find nearby pharmacies and check partner-reported medicine availability across India.",
  keywords: [
    "about DawaSetu",
    "India medicine availability network",
    "find nearby pharmacies",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About DawaSetu | India’s Medicine Availability Network",
    description:
      "How DawaSetu connects people with nearby pharmacies reporting medicine availability.",
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  const details = getPublicBusinessDetails();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: details.legalName || "DawaSetu",
    url:
      process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app",
    description:
      "India’s medicine availability network connecting people with nearby pharmacies and care partners.",
    ...(details.address ? { address: details.address } : {}),
    ...(details.supportEmail ? { email: details.supportEmail } : {}),
    ...(details.supportPhone ? { telephone: details.supportPhone } : {}),
  };
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">About DawaSetu</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
          India’s Medicine Availability Network
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          DawaSetu helps people discover which nearby pharmacies and care
          partners report medicine availability, and gives them a direct way to
          contact the business before visiting.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          Operated by {details.legalName || "DawaSetu"}
          {details.address ? `, ${details.address}` : ""}. For support or
          business enquiries, visit our{" "}
          <Link className="font-medium text-teal-800 underline" href="/contact">
            Contact page
          </Link>
          .
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [
              "Availability discovery",
              "Search by product, brand, composition, strength, or manufacturer.",
            ],
            [
              "Verified local partners",
              "Businesses are reviewed before public listings can go live.",
            ],
            [
              "Privacy by design",
              "Distributor inventory remains private and is excluded from public results.",
            ],
          ].map(([title, text]) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h2 className="font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          DawaSetu is an availability and connection platform. Listings are
          partner-reported, can change, and are not medical advice. Confirm
          stock directly with the pharmacy. Ask a doctor or pharmacist before
          changing a prescribed medicine.
        </p>
        <Button asChild className="mt-7">
          <Link href="/medicines">Find a medicine</Link>
        </Button>
        <Link
          className="ml-4 text-sm font-medium text-teal-800 underline"
          href="/privacy"
        >
          Read our privacy policy
        </Link>
      </div>
    </main>
  );
}
