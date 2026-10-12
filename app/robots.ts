import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/medicines", "/pharmacies", "/about", "/blog"],
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
