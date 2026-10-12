"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validClick2BookUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "click2book.in" ||
        url.hostname.endsWith(".click2book.in")) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export async function saveDoctorBookingProfileAction(formData: FormData) {
  const id = field(formData, "doctor_id");
  const businessId = field(formData, "business_id");
  const name = field(formData, "full_name");
  const slug = field(formData, "slug");
  const specialty = field(formData, "specialty");
  const description = field(formData, "description");
  const bookingUrl = field(formData, "booking_url");
  const order = Number(field(formData, "display_order"));
  if (
    (id && !/^[0-9a-f-]{36}$/i.test(id)) ||
    (businessId && !/^[0-9a-f-]{36}$/i.test(businessId)) ||
    name.length < 2 ||
    name.length > 160 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 180 ||
    specialty.length < 2 ||
    specialty.length > 120 ||
    description.length > 2000 ||
    bookingUrl.length > 2048 ||
    !validClick2BookUrl(bookingUrl) ||
    !Number.isInteger(order) ||
    order < 0 ||
    order > 10000
  ) {
    redirect("/admin/doctors?error=invalid");
  }
  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc("admin_save_doctor_booking_profile", {
      p_doctor_id: id || null,
      p_business_id: businessId || null,
      p_full_name: name,
      p_slug: slug,
      p_specialty: specialty,
      p_description: description || null,
      p_booking_url: bookingUrl,
      p_display_order: order,
      p_is_active: formData.get("is_active") === "on",
    });
    if (error) redirect("/admin/doctors?error=save");
    revalidatePath("/admin/doctors");
    revalidatePath("/doctors");
    revalidatePath(`/doctors/${slug}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/doctors?error=save");
  }
  redirect("/admin/doctors?updated=1");
}

export async function deleteDoctorBookingProfileAction(formData: FormData) {
  const id = field(formData, "doctor_id");
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    field(formData, "confirm_delete") !== "yes"
  ) {
    redirect("/admin/doctors?error=confirm");
  }
  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc(
      "admin_delete_doctor_booking_profile",
      { p_doctor_id: id },
    );
    if (error) redirect("/admin/doctors?error=delete");
    revalidatePath("/admin/doctors");
    revalidatePath("/doctors");
    revalidatePath("/sitemap.xml");
    revalidatePath("/");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/doctors?error=delete");
  }
  redirect("/admin/doctors?updated=deleted");
}
