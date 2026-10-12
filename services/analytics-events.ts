import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getVisitorHash(
  requestHeaders: Headers,
  category: string,
  recordId: string,
) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const address =
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (address === "unknown") return null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? "";
  const date = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", key)
    .update(`${category}:${recordId}:${address}:${userAgent}:${date}`)
    .digest("hex");
}

export async function recordPublicBusinessProfileView(businessId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return;
  try {
    const requestHeaders = await headers();
    const visitorHash = getVisitorHash(requestHeaders, "profile", businessId);
    if (!visitorHash) return;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = createSupabaseAdminClient();
    await admin.rpc("service_record_business_profile_view", {
      p_business_id: businessId,
      p_viewer_user_id: user?.id ?? null,
      p_visitor_hash: visitorHash,
    });
  } catch {
    // Analytics failures must not prevent a customer from viewing a partner.
  }
}

export async function recordPublicMedicineSearch(medicineIds: string[]) {
  const uniqueIds = [...new Set(medicineIds)].filter((id) =>
    /^[0-9a-f-]{36}$/i.test(id),
  );
  if (uniqueIds.length === 0) return;
  try {
    const requestHeaders = await headers();
    const admin = createSupabaseAdminClient();
    const events = uniqueIds.flatMap((medicineId) => {
      const visitorHash = getVisitorHash(requestHeaders, "search", medicineId);
      return visitorHash ? [{ medicineId, visitorHash }] : [];
    });
    if (events.length === 0) return;
    await admin.rpc("service_record_medicine_searches", {
      p_medicine_ids: events.map((event) => event.medicineId),
      p_visitor_hashes: events.map((event) => event.visitorHash),
    });
  } catch {
    // Search trends are supplementary and must not block availability results.
  }
}
