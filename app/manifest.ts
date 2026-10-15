import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DawaSetu — India’s Medicine Availability Network",
    short_name: "DawaSetu",
    description: "Find medicines. Find nearby.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7fbfa",
    theme_color: "#0f766e",
    categories: ["medical", "health"],
    icons: [
      {
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
