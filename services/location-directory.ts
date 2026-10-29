import type { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LocationStateOption {
  id: string;
  name: string;
}

export interface LocationDistrictOption {
  id: string;
  name: string;
  state_id: string;
}

export async function getActiveLocationHierarchy(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const [
    { data: states, error: statesError },
    { data: districts, error: districtsError },
  ] = await Promise.all([
    supabase
      .from("states")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("districts")
      .select("id, name, state_id")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (statesError) throw statesError;
  if (districtsError) throw districtsError;

  return {
    states: (states ?? []) as LocationStateOption[],
    districts: (districts ?? []) as LocationDistrictOption[],
  };
}
