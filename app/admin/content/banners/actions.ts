"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

function safeTargetUrl(value: string): string | null | undefined {
  if (!value) return null;
  if (value.length > 2048 || /[\s\\]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function revalidateBannerPages() {
  revalidatePath("/");
  revalidatePath("/admin/content");
  revalidatePath("/admin/content/banners");
}

export async function createHomepageBannerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const title = field(formData, "title");
  const altText = field(formData, "alt_text");
  const targetInput = field(formData, "target_url");
  const orderInput = field(formData, "display_order");
  const file = formData.get("image");
  const displayOrder = orderInput ? Number(orderInput) : 0;
  const targetUrl = safeTargetUrl(targetInput);

  if (title.length < 2 || title.length > 160)
    return { error: "Banner title must contain 2 to 160 characters." };
  if (altText.length < 5 || altText.length > 240)
    return { error: "Add an image description between 5 and 240 characters." };
  if (targetUrl === undefined)
    return {
      error: "Use a safe same-site path or a complete HTTPS destination URL.",
    };
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 999)
    return { error: "Banner order must be a whole number from 0 to 999." };
  if (!(file instanceof File) || file.size < 1 || file.size > 700_000)
    return { error: "Choose an image file smaller than 700 KB." };
  if (!imageExtensions[file.type])
    return { error: "Upload a JPG, PNG, or WebP image." };
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!validImageSignature(file.type, signature))
    return { error: "The selected file does not match its image type." };

  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const imagePath = `${randomUUID()}.${imageExtensions[file.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("homepage-banners")
      .upload(imagePath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError)
      return {
        error: "Image upload failed. Check the file and try again.",
      };

    const { error: saveError } = await supabase.rpc(
      "admin_create_homepage_banner",
      {
        p_title: title,
        p_image_path: imagePath,
        p_alt_text: altText,
        p_target_url: targetUrl,
        p_display_order: displayOrder,
        p_is_active: formData.get("is_active") === "on",
      },
    );
    if (saveError) {
      await supabase.storage.from("homepage-banners").remove([imagePath]);
      return {
        error: "Banner could not be saved. Check your content permissions.",
      };
    }

    revalidateBannerPages();
    return { message: "Homepage banner saved." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Banner management is temporarily unavailable." };
  }
}

export async function setHomepageBannerActiveAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const bannerId = field(formData, "banner_id");
  const activeValue = field(formData, "is_active");
  if (!/^[0-9a-f-]{36}$/i.test(bannerId))
    return { error: "Choose a valid banner." };
  if (activeValue !== "true" && activeValue !== "false")
    return { error: "Choose a valid banner status." };
  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc("admin_set_homepage_banner_active", {
      p_banner_id: bannerId,
      p_is_active: activeValue === "true",
    });
    if (error) return { error: "Banner status could not be updated." };
    revalidateBannerPages();
    return {
      message: activeValue === "true" ? "Banner published." : "Banner paused.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Banner management is temporarily unavailable." };
  }
}
