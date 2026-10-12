import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

import { Brand } from "@/components/brand/brand";
import { BusinessReviewForm } from "@/components/business/business-review-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { recordPublicBusinessProfileView } from "@/services/analytics-events";
import {
  getMyBusinessReview,
  getPublicBusinessProfile,
} from "@/services/business-directory";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { profile } = await getPublicBusinessProfile(slug);
  return profile
    ? {
        title: profile.business_name,
        description: `${profile.business_type} and partner-reported medicine availability on DawaSetu.`,
      }
    : { title: "Partner profile" };
}

function openingHoursText(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "Hours not provided";
  const record = value as Record<string, unknown>;
  if (record.closed === true) return "Closed";
  if (typeof record.open === "string" && typeof record.close === "string") {
    return `${record.open} – ${record.close}`;
  }
  return "Hours not provided";
}

export default async function PublicBusinessPage({
  params,
}: {
  params: PageParams;
}) {
  const { slug } = await params;
  const result = await getPublicBusinessProfile(slug);
  if (!result.profile && !result.error) notFound();
  const profile = result.profile;
  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Partner details are temporarily unavailable"
            description="Please return to the directory and try again."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/pharmacies">Browse pharmacies</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }
  await recordPublicBusinessProfileView(profile.business_id);
  const { userId, review: myReview } = await getMyBusinessReview(
    profile.business_id,
  );

  const address = [
    profile.address_line1,
    profile.address_line2,
    profile.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const directionsUrl =
    profile.latitude !== null && profile.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${profile.latitude},${profile.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${profile.business_name}, ${address}`)}`;
  const whatsappNumber = profile.whatsapp_e164?.replace(/[^0-9]/g, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: profile.business_name,
    telephone: profile.phone_e164,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/pharmacies/${encodeURIComponent(profile.business_slug)}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: [profile.address_line1, profile.address_line2]
        .filter(Boolean)
        .join(", "),
      postalCode: profile.postal_code ?? undefined,
      addressCountry: "IN",
    },
    ...(profile.latitude !== null && profile.longitude !== null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: profile.latitude,
            longitude: profile.longitude,
          },
        }
      : {}),
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/pharmacies">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Directory
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/medicines">Find medicine</Link>
            </Button>
          </nav>
        </header>

        <section className="rounded-3xl bg-[linear-gradient(120deg,_#0f5557_0%,_#13876e_100%)] p-6 text-white shadow-sm sm:p-9">
          <p className="text-sm font-medium text-teal-50">
            Approved DawaSetu partner
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {profile.business_name}
          </h1>
          <p className="mt-2 text-sm text-teal-50">{profile.business_type}</p>
          {profile.description && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-teal-50">
              {profile.description}
            </p>
          )}
          <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-white">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {address}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a href={`tel:${profile.phone_e164}`}>
                <Phone aria-hidden="true" className="size-4" />
                Call partner
              </a>
            </Button>
            {whatsappNumber && (
              <Button asChild variant="secondary">
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                </a>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="border-white/60 bg-transparent text-white hover:bg-white/10"
            >
              <a href={directionsUrl} target="_blank" rel="noreferrer">
                Directions
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </Button>
            {profile.google_business_url && (
              <Button
                asChild
                variant="outline"
                className="border-white/60 bg-transparent text-white hover:bg-white/10"
              >
                <a
                  href={profile.google_business_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google profile
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              </Button>
            )}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <Card>
            <CardHeader>
              <CardTitle>Opening hours</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(profile.opening_hours ?? {}).length === 0 ? (
                <p className="text-sm text-slate-600">
                  Hours have not been provided.
                </p>
              ) : (
                <dl className="grid gap-3 text-sm">
                  {Object.entries(profile.opening_hours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between gap-4">
                      <dt className="font-medium text-slate-800 capitalize">
                        {day.replaceAll("_", " ")}
                      </dt>
                      <dd className="text-right text-slate-600">
                        {openingHoursText(hours)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-800">
                  Partner-reported stock
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  Medicines reported available
                </h2>
              </div>
              <Link
                href="/medicines"
                className="text-sm font-semibold text-teal-800 hover:underline"
              >
                Search all medicines
              </Link>
            </div>
            {result.medicines.length === 0 ? (
              <EmptyState
                title="No medicine availability is currently listed"
                description="This partner may still be able to help. Call to ask and confirm before travelling."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {result.medicines.map((medicine) => (
                  <Card key={medicine.medicine_id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-950">
                          {medicine.product_name}
                        </h3>
                        <StatusBadge
                          status={
                            medicine.inventory_status === "available"
                              ? "Available"
                              : "Low Stock"
                          }
                        />
                      </div>
                      {medicine.brand_name && (
                        <p className="mt-1 text-sm text-slate-600">
                          Brand: {medicine.brand_name}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-slate-600">
                        {medicine.strength}
                      </p>
                      {medicine.composition && (
                        <p className="mt-2 text-xs text-slate-500">
                          Composition: {medicine.composition}
                        </p>
                      )}
                      {medicine.manufacturer_name && (
                        <p className="mt-1 text-xs text-slate-500">
                          Manufacturer: {medicine.manufacturer_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
        {result.promotions.length > 0 && (
          <section aria-labelledby="partner-promotions-title" className="mt-7">
            <p className="text-sm font-semibold text-teal-800">
              Offers and placements
            </p>
            <h2
              id="partner-promotions-title"
              className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
            >
              Current partner updates
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.promotions.map((promotion) => (
                <Card key={promotion.promotion_id}>
                  <CardContent className="p-5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${promotion.promotion_type === "sponsored_listing" ? "bg-violet-100 text-violet-900" : promotion.promotion_type === "featured_listing" ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900"}`}
                    >
                      {promotion.promotion_type === "sponsored_listing"
                        ? "Sponsored listing"
                        : promotion.promotion_type === "featured_listing"
                          ? "Featured listing"
                          : "Partner offer"}
                    </span>
                    <h3 className="mt-3 font-semibold text-slate-950">
                      {promotion.title}
                    </h3>
                    {promotion.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {promotion.description}
                      </p>
                    )}
                    {(promotion.starts_at || promotion.ends_at) && (
                      <p className="mt-3 text-xs text-slate-500">
                        {promotion.starts_at
                          ? `From ${new Date(promotion.starts_at).toLocaleDateString("en-IN")}`
                          : "Available now"}
                        {promotion.ends_at
                          ? ` · Until ${new Date(promotion.ends_at).toLocaleDateString("en-IN")}`
                          : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
        <section
          id="reviews"
          aria-labelledby="business-reviews-title"
          className="mt-7"
        >
          <div className="mb-4">
            <p className="text-sm font-semibold text-teal-800">
              Customer feedback
            </p>
            <h2
              id="business-reviews-title"
              className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
            >
              Reviews
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {result.reviews.length
                ? `${result.reviews.length} moderated customer review${result.reviews.length === 1 ? "" : "s"}`
                : "No published reviews yet."}
            </p>
          </div>
          {result.reviews.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.reviews.map((review) => (
                <Card key={review.review_id}>
                  <CardContent className="p-5">
                    <p
                      className="font-semibold text-amber-700"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {"★".repeat(review.rating)}
                      <span className="ml-2 text-sm text-slate-700">
                        {review.rating}/5
                      </span>
                    </p>
                    {review.review_text && (
                      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                        {review.review_text}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      DawaSetu customer ·{" "}
                      {new Date(review.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Share your experience</CardTitle>
            </CardHeader>
            <CardContent>
              {userId ? (
                <BusinessReviewForm
                  businessId={profile.business_id}
                  businessSlug={profile.business_slug}
                  review={myReview}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-slate-600">
                    Sign in with a customer account to leave a moderated review.
                  </p>
                  <Button asChild variant="outline">
                    <Link
                      href={`/login?next=${encodeURIComponent(`/pharmacies/${profile.business_slug}#reviews`)}`}
                    >
                      Sign in to review
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        <p className="mt-6 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          Availability may change. Please contact the partner to confirm.
          DawaSetu does not recommend automatically substituting prescription
          medicines.
        </p>
      </div>
    </main>
  );
}
