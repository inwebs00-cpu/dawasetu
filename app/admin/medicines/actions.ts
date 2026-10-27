"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { parseCsv, parseCsvBoolean } from "@/lib/import/csv";
import type { AuthActionState } from "@/types/auth";

export interface MedicineBulkImportState extends AuthActionState {
  rows?: Array<{
    line: number;
    result: "imported" | "duplicate" | "error";
    message: string;
  }>;
}

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

export async function bulkImportAdminMedicinesAction(
  _previousState: MedicineBulkImportState,
  formData: FormData,
): Promise<MedicineBulkImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (file.size > 1_900_000) {
    return { error: "CSV files must be smaller than 1.9 MB." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Upload a .csv file." };
  }

  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(await file.text(), 500);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "The CSV file is invalid.",
    };
  }
  const requiredHeaders = [
    "product_name",
    "composition",
    "strength",
    "manufacturer",
  ];
  const missingHeaders = requiredHeaders.filter(
    (header) => !parsed.headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      error: `CSV is missing required columns: ${missingHeaders.join(", ")}.`,
    };
  }

  const rows: NonNullable<MedicineBulkImportState["rows"]> = [];
  const validRecords: Array<Record<string, string | number | boolean | null>> =
    [];
  for (const row of parsed.rows) {
    const fields = row.values;
    const productName = fields.product_name ?? "";
    const brandName = fields.brand_name ?? "";
    const composition = fields.composition ?? "";
    const strength = fields.strength ?? "";
    const manufacturer = fields.manufacturer ?? "";
    const categorySlug = fields.category_slug ?? "";
    const medicineType = fields.medicine_type || "tablet";
    const prescriptionClass = fields.prescription_class || "unknown";
    const packaging = fields.packaging ?? "";
    const publicVisibility = parseCsvBoolean(fields.public_visibility, true);
    let rowError = "";

    if (productName.length < 1 || productName.length > 240) {
      rowError = "Product name must be 1–240 characters.";
    } else if (brandName.length > 240) {
      rowError = "Brand name must be 240 characters or fewer.";
    } else if (composition.length < 2 || composition.length > 240) {
      rowError = "Composition must be 2–240 characters.";
    } else if (strength.length < 1 || strength.length > 120) {
      rowError = "Strength must be 1–120 characters.";
    } else if (manufacturer.length < 2 || manufacturer.length > 200) {
      rowError = "Manufacturer must be 2–200 characters.";
    } else if (categorySlug.length > 80) {
      rowError = "Category slug must be 80 characters or fewer.";
    } else if (
      !new Set([
        "tablet",
        "capsule",
        "syrup",
        "injection",
        "ointment",
        "drops",
        "inhaler",
        "device",
        "other",
      ]).has(medicineType)
    ) {
      rowError = "Medicine type is invalid.";
    } else if (
      !new Set(["prescription", "otc", "unknown"]).has(prescriptionClass)
    ) {
      rowError = "Prescription classification is invalid.";
    } else if (packaging.length > 160) {
      rowError = "Packaging must be 160 characters or fewer.";
    } else if (publicVisibility === null) {
      rowError = "Public visibility must be true/false or yes/no.";
    }

    if (rowError) {
      rows.push({ line: row.line, result: "error", message: rowError });
      continue;
    }

    validRecords.push({
      row_number: row.line,
      product_name: productName,
      brand_name: brandName,
      composition,
      strength,
      manufacturer,
      category_slug: categorySlug,
      medicine_type: medicineType,
      prescription_class: prescriptionClass,
      packaging,
      public_visibility: publicVisibility,
    });
  }

  if (validRecords.length > 0) {
    try {
      const { supabase } = await requirePlatformPermission("medicines.manage");
      const { data, error } = await supabase.rpc(
        "admin_bulk_import_medicines",
        { p_records: validRecords },
      );
      if (error || !Array.isArray(data)) {
        return {
          error:
            "The medicine batch could not be imported. Confirm the database migration is applied and retry.",
          rows,
        };
      }
      for (const item of data as Array<{
        row_number: number;
        result: "imported" | "duplicate" | "error";
        message: string;
      }>) {
        rows.push({
          line: item.row_number,
          result: item.result,
          message: item.message,
        });
      }
      revalidatePath("/admin");
      revalidatePath("/admin/medicines");
      revalidatePath("/");
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error;
      return {
        error: "Medicine import is temporarily unavailable.",
        rows,
      };
    }
  }

  rows.sort((a, b) => a.line - b.line);
  const importedCount = rows.filter((row) => row.result === "imported").length;
  const duplicateCount = rows.filter(
    (row) => row.result === "duplicate",
  ).length;
  const errorCount = rows.filter((row) => row.result === "error").length;
  return {
    message: `${importedCount} added for review · ${duplicateCount} duplicates · ${errorCount} rows need correction.`,
    rows,
  };
}

export async function saveAdminMedicineAction(
  medicineId: string | null,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const productName = value(formData, "product_name");
  const brandName = value(formData, "brand_name");
  const composition = value(formData, "composition");
  const strength = value(formData, "strength");
  const manufacturer = value(formData, "manufacturer");
  const categoryId = value(formData, "category_id") || null;
  const medicineType = value(formData, "medicine_type");
  const prescriptionClass = value(formData, "prescription_class");
  const packaging = value(formData, "packaging");
  if (medicineId && !/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (productName.length < 1 || productName.length > 240)
    return { error: "Product name must be between 1 and 240 characters." };
  if (
    brandName.length > 240 ||
    composition.length < 2 ||
    composition.length > 240 ||
    strength.length < 1 ||
    strength.length > 120 ||
    manufacturer.length < 2 ||
    manufacturer.length > 200 ||
    packaging.length > 160
  )
    return {
      error:
        "Check composition, strength, manufacturer, brand, and packaging fields.",
    };
  if (
    !new Set([
      "tablet",
      "capsule",
      "syrup",
      "injection",
      "ointment",
      "drops",
      "inhaler",
      "device",
      "other",
    ]).has(medicineType)
  )
    return { error: "Choose a valid medicine type." };
  if (!new Set(["prescription", "otc", "unknown"]).has(prescriptionClass))
    return { error: "Choose a valid prescription classification." };
  if (categoryId && !/^[0-9a-f-]{36}$/i.test(categoryId))
    return { error: "Choose a valid category." };
  try {
    const { supabase } = await requirePlatformPermission("medicines.manage");
    const { error } = await supabase.rpc("admin_save_medicine", {
      p_medicine_id: medicineId,
      p_product_name: productName,
      p_brand_name: brandName || null,
      p_composition: composition,
      p_strength: strength,
      p_manufacturer: manufacturer,
      p_category_id: categoryId,
      p_medicine_type: medicineType,
      p_prescription_class: prescriptionClass,
      p_packaging: packaging || null,
      p_public_visibility: formData.get("public_visibility") === "on",
    });
    if (error)
      return {
        error:
          "Medicine could not be saved. Check the fields and whether the product already exists.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/medicines");
    return {
      message:
        "Saved as pending verification. Review it before it becomes publicly searchable.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Medicine administration is temporarily unavailable." };
  }
}

export async function reviewAdminMedicineAction(
  medicineId: string,
  decision: "approved" | "rejected",
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (decision !== "approved" && decision !== "rejected")
    return { error: "Choose a valid review decision." };
  const note = value(formData, "review_note");
  if (note.length > 1000)
    return { error: "Review note must be 1,000 characters or fewer." };
  try {
    const { supabase } = await requirePlatformPermission("medicines.approve");
    const { error } = await supabase.rpc("admin_review_medicine", {
      p_medicine_id: medicineId,
      p_decision: decision,
      p_note: note || null,
    });
    if (error)
      return {
        error:
          "This medicine could not be reviewed. It may no longer be pending.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/medicines");
    return {
      message:
        decision === "approved"
          ? "Medicine approved for the master database."
          : "Medicine rejected.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Medicine review is temporarily unavailable." };
  }
}
