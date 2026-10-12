"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function phone(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  const normalized = /^\d{10}$/.test(digits) ? `+91${digits}` : `+${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}

export async function createBusinessAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const ownerEmail = text(formData, "owner_email").toLowerCase();
  const typeId = text(formData, "business_type_id");
  const name = text(formData, "business_name");
  const registration = text(formData, "registration_number");
  const phoneNumber = phone(text(formData, "phone"));
  const whatsappInput = text(formData, "whatsapp");
  const whatsapp = whatsappInput ? phone(whatsappInput) : null;
  const email = text(formData, "email").toLowerCase();
  const address = text(formData, "address_line1");
  const addressLine2 = text(formData, "address_line2");
  const areaId = text(formData, "area_id");
  const postalCode = text(formData, "postal_code");
  const description = text(formData, "description");
  const latitudeInput = text(formData, "latitude");
  const longitudeInput = text(formData, "longitude");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || ownerEmail.length > 254)
    return { error: "Enter the email of an active DawaSetu user." };
  if (!/^[0-9a-f-]{36}$/i.test(typeId))
    return { error: "Choose a business type." };
  if (name.length < 2 || name.length > 200 || registration.length > 100)
    return { error: "Check the business name and registration number." };
  if (!phoneNumber || (whatsappInput && !whatsapp))
    return { error: "Enter valid business and WhatsApp phone numbers." };
  if (
    email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
  )
    return { error: "Enter a valid business email." };
  if (
    address.length < 5 ||
    address.length > 240 ||
    addressLine2.length > 240 ||
    description.length > 1000
  )
    return { error: "Check the address and description fields." };
  if (areaId && !/^[0-9a-f-]{36}$/i.test(areaId))
    return { error: "Choose a valid area." };
  if (postalCode && !/^\d{6}$/.test(postalCode))
    return { error: "PIN code must contain six digits." };
  const latitude = latitudeInput ? Number(latitudeInput) : null;
  const longitude = longitudeInput ? Number(longitudeInput) : null;
  if (
    (latitude !== null &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
    (latitude === null) !== (longitude === null)
  )
    return { error: "Provide both valid coordinates or leave both blank." };
  try {
    const { supabase } = await requirePlatformPermission("partners.manage");
    const { error } = await supabase.rpc("admin_create_business", {
      p_owner_email: ownerEmail,
      p_business_type_id: typeId,
      p_business_name: name,
      p_registration_number: registration || null,
      p_phone_e164: phoneNumber,
      p_whatsapp_e164: whatsapp,
      p_email: email || null,
      p_address_line1: address,
      p_address_line2: addressLine2 || null,
      p_area_id: areaId || null,
      p_postal_code: postalCode || null,
      p_latitude: latitude,
      p_longitude: longitude,
      p_description: description || null,
    });
    if (error)
      return {
        error:
          "Business could not be created. Verify the owner has an active account and the details are valid.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/partners");
    revalidatePath("/partner");
    return {
      message:
        "Business added as pending verification. Public visibility is off until it is approved.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Business administration is temporarily unavailable." };
  }
}
