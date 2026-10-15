import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/medicines",
        "/pharmacies",
        "/about",
        "/blog",
        "/doctors",
        "/contact",
        "/privacy",
        "/terms",
        "/refund-cancellation",
      ],
      disallow: [
        "/admin",
        "/partner",
        "/distributor",
        "/account",
        "/requests",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${origin.replace(/\/$/, "")}/sitemap.xml`,
  };
}
