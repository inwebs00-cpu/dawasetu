"use server";

import { revalidatePath } from "next/cache";

import { parseCsv, parseCsvBoolean } from "@/lib/import/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/types/auth";

export interface MedicineMasterOption {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  category_name: string | null;
  medicine_type: string;
  prescription_class: string;
  packaging: string | null;
  medicine_status: string;
}

export interface InventorySearchState extends AuthActionState {
  results?: MedicineMasterOption[];
}

export interface InventoryBulkImportState extends AuthActionState {
  rows?: Array<{
    line: number;
    result: "imported" | "not_found" | "ambiguous" | "error";
    message: string;
  }>;
}

async function getAuthorizedClient(businessId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "active") return null;
  const { data: canManage, error } = await supabase.rpc(
    "has_business_permission",
    {
      p_business_id: businessId,
      p_permission_key: "inventory.manage",
    },
  );
  if (error || canManage !== true) return null;
  return { supabase, user };
}

export async function searchMedicineMasterAction(
  businessId: string,
  _previousState: InventorySearchState,
  formData: FormData,
): Promise<InventorySearchState> {
  const value = formData.get("query");
  const query = typeof value === "string" ? value.trim() : "";
  if (query.length < 2 || query.length > 120) {
    return { error: "Enter at least two characters to search." };
  }
  try {
    const context = await getAuthorizedClient(businessId);
    if (!context)
      return {
        error: "You do not have permission to manage this business inventory.",
      };
    const { data, error } = await context.supabase.rpc(
      "search_medicine_master",
      {
        p_query: query,
      },
    );
    if (error || !Array.isArray(data))
      return { error: "Medicine search is temporarily unavailable." };
    return { results: data as MedicineMasterOption[] };
  } catch {
    return { error: "Medicine search is temporarily unavailable." };
  }
}

export async function addInventoryItemAction(
  businessId: string,
  medicineId: string,
  _previousState: AuthActionState,
  _formData: FormData,
): Promise<AuthActionState> {
  void _previousState;
  void _formData;
  if (!/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  try {
    const context = await getAuthorizedClient(businessId);
    if (!context)
      return {
        error: "You do not have permission to manage this business inventory.",
      };
    const { error } = await context.supabase.rpc("add_partner_inventory_item", {
      p_business_id: businessId,
      p_medicine_id: medicineId,
    });
    if (error)
      return {
        error:
          "This medicine could not be added. It may need admin approval first.",
      };
    revalidatePath(`/partner/${businessId}`);
    revalidatePath(`/partner/${businessId}/inventory`);
    return {
      message:
        "Medicine added as out of stock. Update its availability before it is shown.",
    };
  } catch {
    return { error: "Inventory is temporarily unavailable." };
  }
}

export async function updateInventoryStatusAction(
  businessId: string,
  medicineId: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const statusValue = formData.get("status");
  const quantityValue = formData.get("quantity");
  const status = typeof statusValue === "string" ? statusValue : "";
  const rawQuantity =
    typeof quantityValue === "string" ? quantityValue.trim() : "";
  const quantity = rawQuantity === "" ? null : Number(rawQuantity);
  const publicVisible = formData.get("public_visible") === "on";

  if (!/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (!new Set(["available", "low_stock", "out_of_stock"]).has(status)) {
    return { error: "Choose a valid availability status." };
  }
  if (
    quantity !== null &&
    (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000)
  ) {
    return { error: "Quantity must be a whole number from 0 to 1,000,000." };
  }
  if (quantity === 0 && status !== "out_of_stock") {
    return { error: "Zero quantity must be marked out of stock." };
  }

  try {
    const context = await getAuthorizedClient(businessId);
    if (!context)
      return {
        error: "You do not have permission to manage this business inventory.",
      };
    const { error } = await context.supabase.rpc("upsert_partner_inventory", {
      p_business_id: businessId,
      p_medicine_id: medicineId,
      p_status: status,
      p_quantity: quantity,
      p_public_visible: publicVisible,
    });
    if (error)
      return {
        error:
          "Availability could not be updated. Check the medicine approval and quantity.",
      };
    revalidatePath(`/partner/${businessId}`);
    revalidatePath(`/partner/${businessId}/inventory`);
    return { message: "Availability updated." };
  } catch {
    return { error: "Availability is temporarily unavailable." };
  }
}

export async function bulkImportPartnerInventoryAction(
  businessId: string,
  _previousState: InventoryBulkImportState,
  formData: FormData,
): Promise<InventoryBulkImportState> {
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
  const missingHeaders = ["product_name", "strength"].filter(
    (header) => !parsed.headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      error: `CSV is missing required columns: ${missingHeaders.join(", ")}.`,
    };
  }

  const rows: NonNullable<InventoryBulkImportState["rows"]> = [];
  const validRecords: Array<Record<string, string | number | boolean | null>> =
    [];
  for (const row of parsed.rows) {
    const fields = row.values;
    const productName = fields.product_name ?? "";
    const strength = fields.strength ?? "";
    const manufacturer = fields.manufacturer ?? "";
    const status = (fields.status || "available").toLowerCase();
    const quantity = fields.quantity ?? "";
    const publicVisible = parseCsvBoolean(fields.public_visible, true);
    let rowError = "";

    if (productName.length < 1 || productName.length > 240) {
      rowError = "Product name must be 1–240 characters.";
    } else if (strength.length < 1 || strength.length > 120) {
      rowError = "Strength must be 1–120 characters.";
    } else if (manufacturer.length > 200) {
      rowError = "Manufacturer must be 200 characters or fewer.";
    } else if (
      !new Set(["available", "low_stock", "out_of_stock"]).has(status)
    ) {
      rowError = "Status must be available, low_stock or out_of_stock.";
    } else if (quantity && !/^(0|[1-9][0-9]{0,6})$/.test(quantity)) {
      rowError = "Quantity must be a whole number from 0 to 1,000,000.";
    } else if (quantity && Number(quantity) > 1_000_000) {
      rowError = "Quantity must be a whole number from 0 to 1,000,000.";
    } else if (quantity === "0" && status !== "out_of_stock") {
      rowError = "Zero quantity must be marked out_of_stock.";
    } else if (publicVisible === null) {
      rowError = "Public visibility must be true/false or yes/no.";
    }

    if (rowError) {
      rows.push({ line: row.line, result: "error", message: rowError });
      continue;
    }

    validRecords.push({
      row_number: row.line,
      product_name: productName,
      strength,
      manufacturer,
      status,
      quantity: quantity === "" ? null : Number(quantity),
      public_visible: publicVisible,
    });
  }

  if (validRecords.length > 0) {
    try {
      const context = await getAuthorizedClient(businessId);
      if (!context) {
        return {
          error:
            "You do not have permission to manage this pharmacy, clinic or nursing home inventory.",
          rows,
        };
      }
      const { data, error } = await context.supabase.rpc(
        "partner_bulk_upsert_inventory",
        { p_business_id: businessId, p_records: validRecords },
      );
      if (error || !Array.isArray(data)) {
        return {
          error:
            "The inventory batch could not be imported. Confirm the database migration is applied and retry.",
          rows,
        };
      }
      for (const item of data as Array<{
        row_number: number;
        result: "imported" | "not_found" | "ambiguous" | "error";
        message: string;
      }>) {
        rows.push({
          line: item.row_number,
          result: item.result,
          message: item.message,
        });
      }
      revalidatePath(`/partner/${businessId}`);
      revalidatePath(`/partner/${businessId}/inventory`);
      revalidatePath("/pharmacies");
      revalidatePath("/medicines");
      revalidatePath("/");
    } catch {
      return { error: "Inventory import is temporarily unavailable.", rows };
    }
  }

  rows.sort((a, b) => a.line - b.line);
  const importedCount = rows.filter((row) => row.result === "imported").length;
  const notFoundCount = rows.filter(
    (row) => row.result === "not_found" || row.result === "ambiguous",
  ).length;
  const errorCount = rows.filter((row) => row.result === "error").length;
  return {
    message: `${importedCount} inventory rows updated · ${notFoundCount} medicine matches need review · ${errorCount} rows need correction.`,
    rows,
  };
}

export async function submitPartnerMedicineAction(
  businessId: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const productName = field("product_name");
  const brandName = field("brand_name");
  const composition = field("composition");
  const strength = field("strength");
  const manufacturer = field("manufacturer");
  const medicineType = field("medicine_type");
  const prescriptionClass = field("prescription_class");
  const packaging = field("packaging");
  const categoryValue = field("category_id");
  const categoryId = categoryValue || null;

  if (productName.length < 1 || productName.length > 240)
    return { error: "Product name must be between 1 and 240 characters." };
  if (brandName.length > 240)
    return { error: "Brand name must be 240 characters or fewer." };
  if (composition.length < 2 || composition.length > 240)
    return { error: "Composition must be between 2 and 240 characters." };
  if (strength.length < 1 || strength.length > 120)
    return { error: "Enter a valid medicine strength." };
  if (manufacturer.length < 2 || manufacturer.length > 200)
    return { error: "Manufacturer must be between 2 and 200 characters." };
  if (packaging.length > 160)
    return { error: "Packaging must be 160 characters or fewer." };
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
    const context = await getAuthorizedClient(businessId);
    if (!context)
      return {
        error: "You do not have permission to submit medicine details.",
      };
    const { error } = await context.supabase.rpc("submit_partner_medicine", {
      p_business_id: businessId,
      p_product_name: productName,
      p_brand_name: brandName || null,
      p_composition: composition,
      p_strength: strength,
      p_manufacturer: manufacturer,
      p_medicine_type: medicineType,
      p_prescription_class: prescriptionClass,
      p_packaging: packaging || null,
      p_category_id: categoryId,
    });
    if (error)
      return {
        error:
          "Medicine submission failed. Check whether it already exists or try again.",
      };
    revalidatePath(`/partner/${businessId}/inventory`);
    return {
      message:
        "Medicine submitted for admin verification. It cannot be publicly listed before approval.",
    };
  } catch {
    return { error: "Medicine submission is temporarily unavailable." };
  }
}
