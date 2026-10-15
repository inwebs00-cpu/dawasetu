"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function phone(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  const normalized = /^\d{10}$/.test(digits) ? `+91${digits}` : `+${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}

export async function updateBusinessProfileAction(
  businessId: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(businessId))
    return { error: "Choose a valid business." };
  const businessName = field(formData, "business_name");
  const phoneInput = field(formData, "phone");
  const whatsappInput = field(formData, "whatsapp");
  const phoneNumber = phone(phoneInput);
  const whatsappNumber = whatsappInput ? phone(whatsappInput) : null;
  const email = field(formData, "email").toLowerCase();
  const address = field(formData, "address_line1");
  const addressLine2 = field(formData, "address_line2");
  const postalCode = field(formData, "postal_code");
  const description = field(formData, "description");
  const hours = field(formData, "opening_hours");
  const googleUrl = field(formData, "google_business_url");
  const areaIdInput = field(formData, "area_id");
  const latitudeInput = field(formData, "latitude");
  const longitudeInput = field(formData, "longitude");
  const publicAvailability =
    formData.get("public_availability_enabled") === "on";

  if (businessName.length < 2 || businessName.length > 200)
    return { error: "Business name must be between 2 and 200 characters." };
  if (!phoneNumber) return { error: "Enter a valid business phone number." };
  if (whatsappInput && !whatsappNumber)
    return { error: "Enter a valid WhatsApp number." };
  if (
    email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
  )
    return { error: "Enter a valid business email." };
  if (address.length < 5 || address.length > 240 || addressLine2.length > 240)
    return { error: "Enter a valid business address." };
  if (postalCode && !/^\d{6}$/.test(postalCode))
    return { error: "Enter a six-digit Indian PIN code." };
  if (description.length > 1000 || hours.length > 1000)
    return {
      error: "Description and hours must be 1,000 characters or fewer.",
    };
  if (googleUrl && (!/^https:\/\//i.test(googleUrl) || googleUrl.length > 1000))
    return { error: "Google profile URL must begin with https://." };
  if (areaIdInput && !/^[0-9a-f-]{36}$/i.test(areaIdInput))
    return { error: "Choose a valid area." };
  const latitude = latitudeInput ? Number(latitudeInput) : null;
  const longitude = longitudeInput ? Number(longitudeInput) : null;
  if (
    (latitude !== null &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
    (latitude === null) !== (longitude === null)
  ) {
    return { error: "Provide both valid map coordinates or leave them blank." };
  }

  try {
    const { supabase } = await requireBusinessPermission(
      businessId,
      "partners.manage",
    );
    const { data: current, error: currentError } = await supabase
      .from("businesses")
      .select("status")
      .eq("id", businessId)
      .maybeSingle();
    if (currentError || !current)
      return { error: "Business profile is unavailable." };
    if (publicAvailability && current.status !== "approved")
      return {
        error: "Public availability can be enabled after business approval.",
      };

    let areaId: string | null = null;
    if (areaIdInput) {
      const { data: area, error: areaError } = await supabase
        .from("areas")
        .select("id")
        .eq("id", areaIdInput)
        .eq("is_active", true)
        .maybeSingle();
      if (areaError || !area)
        return { error: "Choose an active DawaSetu area." };
      areaId = area.id;
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        business_name: businessName,
        phone_e164: phoneNumber,
        whatsapp_e164: whatsappNumber,
        email: email || null,
        address_line1: address,
        address_line2: addressLine2 || null,
        postal_code: postalCode || null,
        area_id: areaId,
        latitude,
        longitude,
        description: description || null,
        opening_hours: hours ? { schedule: hours } : {},
        google_business_url: googleUrl || null,
        public_availability_enabled: publicAvailability,
      })
      .eq("id", businessId);
    if (error)
      return {
        error:
          "We could not save this profile. Check the fields and try again.",
      };
    revalidatePath(`/partner/${businessId}`);
    revalidatePath(`/partner/${businessId}/profile`);
    revalidatePath("/pharmacies");
    return { message: "Business profile saved." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Business profile is temporarily unavailable." };
  }
}
