"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/types/auth";

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  const normalized = /^\d{10}$/.test(digits) ? `+91${digits}` : `+${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}

function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "partner"}-${randomUUID().slice(0, 8)}`;
}

export async function registerBusinessAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const businessName = value(formData, "business_name");
  const businessTypeId = value(formData, "business_type_id");
  const phone = normalizePhone(value(formData, "phone"));
  const whatsappInput = value(formData, "whatsapp");
  const whatsapp = whatsappInput ? normalizePhone(whatsappInput) : null;
  const email = value(formData, "email").toLowerCase();
  const address = value(formData, "address_line1");
  const area = value(formData, "area");
  const areaId = value(formData, "area_id");
  const district = value(formData, "district");
  const state = value(formData, "state");
  const postalCode = value(formData, "postal_code");
  const openingHours = value(formData, "opening_hours");
  const registrationNumber = value(formData, "registration_number");
  const description = value(formData, "description");
  const latitude = value(formData, "latitude");
  const longitude = value(formData, "longitude");

  if (businessName.length < 2 || businessName.length > 200) {
    return { error: "Business name must be between 2 and 200 characters." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(businessTypeId)) {
    return { error: "Choose a valid business type." };
  }
  if (!phone)
    return {
      error:
        "Enter a valid phone number, including country code if outside India.",
    };
  if (whatsappInput && !whatsapp)
    return { error: "Enter a valid WhatsApp number." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Enter a valid business email." };
  }
  if (address.length < 5 || address.length > 240) {
    return { error: "Enter a complete address between 5 and 240 characters." };
  }
  if ([area, district, state].some((part) => part.length > 100)) {
    return {
      error: "Area, district, and state must be 100 characters or fewer.",
    };
  }
  if (postalCode && !/^\d{6}$/.test(postalCode)) {
    return { error: "Enter a six-digit Indian PIN code." };
  }
  if (
    registrationNumber.length > 100 ||
    description.length > 1000 ||
    openingHours.length > 1000
  ) {
    return { error: "One or more business details are too long." };
  }

  const lat = latitude ? Number(latitude) : null;
  const lng = longitude ? Number(longitude) : null;
  if (
    (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
    (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) ||
    (lat === null) !== (lng === null)
  ) {
    return { error: "Provide both valid map coordinates or leave them blank." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Sign in to register a business." };
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || profile?.status !== "active") {
      return {
        error: "This account cannot submit a partner registration right now.",
      };
    }
    const { data: type, error: typeError } = await supabase
      .from("business_types")
      .select("id, is_distributor")
      .eq("id", businessTypeId)
      .eq("is_active", true)
      .maybeSingle();
    if (typeError || !type || type.is_distributor) {
      return {
        error:
          "Choose a current pharmacy, clinic, or nursing-home business type.",
      };
    }

    let mappedAreaId: string | null = null;
    if (areaId) {
      if (!/^[0-9a-f-]{36}$/i.test(areaId))
        return { error: "Choose a valid area." };
      const { data: mappedArea, error: areaError } = await supabase
        .from("areas")
        .select("id")
        .eq("id", areaId)
        .eq("is_active", true)
        .maybeSingle();
      if (areaError || !mappedArea)
        return { error: "Choose an active DawaSetu area." };
      mappedAreaId = mappedArea.id;
    }

    const addressLine2 =
      [area, district, state].filter(Boolean).join(", ") || null;
    const openingHoursJson = openingHours ? { schedule: openingHours } : {};
    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        owner_user_id: user.id,
        business_type_id: type.id,
        business_name: businessName,
        slug: makeSlug(businessName),
        registration_number: registrationNumber || null,
        description: description || null,
        phone_e164: phone,
        whatsapp_e164: whatsapp,
        email,
        address_line1: address,
        address_line2: addressLine2,
        area_id: mappedAreaId,
        postal_code: postalCode || null,
        latitude: lat,
        longitude: lng,
        opening_hours: openingHoursJson,
        public_availability_enabled: false,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !business) {
      return {
        error:
          "We could not submit this business. Review the details and try again.",
      };
    }
    redirect(`/partner/${business.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Partner registration is temporarily unavailable." };
  }
}
