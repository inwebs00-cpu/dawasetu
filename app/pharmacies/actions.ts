"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

export async function submitBusinessReviewAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const businessIdValue = formData.get("business_id");
  const slugValue = formData.get("business_slug");
  const ratingValue = formData.get("rating");
  const textValue = formData.get("review_text");
  const businessId = typeof businessIdValue === "string" ? businessIdValue : "";
  const slug = typeof slugValue === "string" ? slugValue : "";
  const rating = typeof ratingValue === "string" ? Number(ratingValue) : NaN;
  const reviewText = typeof textValue === "string" ? textValue.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return { error: "Choose a valid partner profile." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Choose a valid partner profile." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Choose a rating from 1 to 5." };
  }
  if (reviewText.length > 2000) {
    return { error: "Review text must be 2,000 characters or fewer." };
  }
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { error } = await supabase.rpc("save_my_business_review", {
      p_business_id: businessId,
      p_rating: rating,
      p_review_text: reviewText || null,
    });
    if (error) {
      return {
        error:
          "The review could not be submitted. Only customers may review a public, approved partner.",
      };
    }
    revalidatePath(`/pharmacies/${slug}`);
    return {
      message:
        "Review submitted for moderation. It will appear on the profile after approval.",
    };
  } catch {
    return { error: "Review submission is temporarily unavailable." };
  }
}

export async function submitBusinessInquiryAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const businessIdValue = formData.get("business_id");
  const slugValue = formData.get("business_slug");
  const medicineValue = formData.get("medicine_id");
  const messageValue = formData.get("message");
  const businessId = typeof businessIdValue === "string" ? businessIdValue : "";
  const slug = typeof slugValue === "string" ? slugValue : "";
  const medicineId = typeof medicineValue === "string" ? medicineValue : "";
  const message = typeof messageValue === "string" ? messageValue.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return { error: "Choose a valid pharmacy." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Choose a valid pharmacy." };
  }
  if (medicineId && !/^[0-9a-f-]{36}$/i.test(medicineId)) {
    return { error: "Choose a listed medicine or leave it blank." };
  }
  if (message.length < 1 || message.length > 1000) {
    return { error: "Message must be between 1 and 1,000 characters." };
  }

  try {
    const { supabase, profile } = await requireAuthenticatedUser();
    if (profile.account_type !== "customer") {
      return {
        error: "Sign in with a customer account to contact this pharmacy.",
      };
    }
    const { error } = await supabase.rpc("create_partner_inquiry", {
      p_business_id: businessId,
      p_medicine_id: medicineId || null,
      p_message: message,
    });
    if (error) {
      return {
        error:
          "The inquiry could not be sent. This pharmacy may be unavailable, or your account may have reached its hourly limit.",
      };
    }
    revalidatePath(`/pharmacies/${slug}`);
    revalidatePath("/account");
    return {
      message:
        "Your inquiry was sent. The pharmacy’s reply will appear in your account notifications.",
    };
  } catch {
    return { error: "Inquiry submission is temporarily unavailable." };
  }
}
