import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCATION_QUERY_PATTERN = /^[\p{L}\p{M}0-9 .,'()/-]{0,60}$/u;

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get("district_id") ?? "";
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!UUID_PATTERN.test(districtId) || !LOCATION_QUERY_PATTERN.test(query)) {
    return NextResponse.json(
      { error: "Invalid location search." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const areaQuery = () =>
      supabase
        .from("areas")
        .select("id, name, postal_code")
        .eq("district_id", districtId)
        .eq("is_active", true)
        .order("name")
        .limit(30);

    const [nameResult, pinResult] = await Promise.all([
      query ? areaQuery().ilike("name", `%${query}%`) : areaQuery(),
      /^\d{6}$/.test(query)
        ? areaQuery().eq("postal_code", query)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (nameResult.error || pinResult.error) {
      return NextResponse.json(
        { error: "Area search is temporarily unavailable." },
        { status: 503 },
      );
    }

    const byId = new Map(
      [...(nameResult.data ?? []), ...(pinResult.data ?? [])].map((area) => [
        area.id,
        area,
      ]),
    );
    return NextResponse.json(
      { areas: [...byId.values()].slice(0, 30) },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Area search is temporarily unavailable." },
      { status: 503 },
    );
  }
}
