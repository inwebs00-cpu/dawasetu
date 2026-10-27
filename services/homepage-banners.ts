import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";
import type { HomepageBanner } from "@/types/homepage-banner";

export type { HomepageBanner } from "@/types/homepage-banner";

export interface AdminHomepageBanner {
  banner_id: string;
  title: string;
  image_path: string;
  alt_text: string;
  target_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function homepageBannerImageUrl(imagePath: string) {
  if (imagePath.startsWith("/banners/")) return imagePath;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/homepage-banners/${encodeURIComponent(imagePath)}`;
}

const defaultBanner: HomepageBanner = {
  id: "dawasetu-launch-banner",
  title: "DawaSetu connects people to pharmacies",
  image_url: homepageBannerImageUrl(
    "00000000-0000-4000-8000-000000000001.jpg",
  ),
  alt_text:
    "DawaSetu helps customers find nearby pharmacy availability and helps pharmacy owners reach local customers.",
  target_url: "/pharmacies",
};

export async function listPublicHomepageBanners(): Promise<HomepageBanner[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_public_homepage_banners");
    if (error || !Array.isArray(data)) return [defaultBanner];
    return data.map((row) => {
      const banner = row as {
        id: string;
        title: string;
        image_path: string;
        alt_text: string;
        target_url: string | null;
      };
      return {
        id: banner.id,
        title: banner.title,
        image_url: homepageBannerImageUrl(banner.image_path),
        alt_text: banner.alt_text,
        target_url: banner.target_url,
      };
    });
  } catch {
    return [defaultBanner];
  }
}
