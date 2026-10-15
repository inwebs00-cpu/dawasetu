import type { MetadataRoute } from "next";

import { getPublishedPosts } from "@/services/content";
import { listPublicBusinesses } from "@/services/business-directory";
import { listPublicDoctorBookingProfiles } from "@/services/doctor-booking";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app"
  ).replace(/\/$/, "");
  const [businesses, posts, doctors] = await Promise.all([
    listPublicBusinesses(100),
    getPublishedPosts(),
    listPublicDoctorBookingProfiles(),
  ]);
  const pages: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/medicines`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/pharmacies`, changeFrequency: "daily", priority: 0.8 },
    { url: `${origin}/doctors`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${origin}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${origin}/refund-cancellation`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    { url: `${origin}/blog`, changeFrequency: "weekly", priority: 0.6 },
  ];
  if (businesses.status === "ready") {
    pages.push(
      ...businesses.rows.map((business) => ({
        url: `${origin}/pharmacies/${encodeURIComponent(business.business_slug)}`,
        lastModified: new Date(business.last_updated_at),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    );
  }
  if (posts.posts.length > 0) {
    pages.push(
      ...posts.posts.map((post) => ({
        url: `${origin}/blog/${encodeURIComponent(post.slug)}`,
        lastModified: new Date(post.published_at),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    );
  }
  if (doctors.status === "ready") {
    pages.push(
      ...doctors.profiles.map((doctor) => ({
        url: `${origin}/doctors/${encodeURIComponent(doctor.slug)}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    );
  }
  return pages;
}
