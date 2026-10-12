import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PublicRedirectWebsite {
  redirect_id: string;
  website_name: string;
  website_url: string;
  description: string | null;
  button_text: string;
  display_position: number;
  open_in_new_tab: boolean;
}

export async function listPublicRedirectWebsites(): Promise<
  PublicRedirectWebsite[]
> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return [];
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("redirect_websites")
      .select(
        "id, name, website_url, description, button_text, display_position, open_in_new_tab",
      )
      .eq("is_active", true)
      .order("display_position", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data.map((website) => ({
      redirect_id: website.id,
      website_name: website.name,
      website_url: website.website_url,
      description: website.description,
      button_text: website.button_text,
      display_position: website.display_position,
      open_in_new_tab: website.open_in_new_tab,
    }));
  } catch {
    return [];
  }
}
