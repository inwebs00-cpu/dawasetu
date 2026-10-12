"use client";

import { useActionState } from "react";

import { saveAdminMedicineAction } from "@/app/admin/medicines/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

interface CategoryOption {
  id: string;
  name: string;
}

export interface MedicineFormValue {
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  category_id: string | null;
  medicine_type: string;
  prescription_class: string;
  packaging: string | null;
  public_visibility: boolean;
  medicine_status: string;
}

function Field({
  label,
  name,
  defaultValue,
  maxLength,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <Input
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
      />
    </label>
  );
}

export function MedicineForm({
  medicineId,
  initial,
  categories,
}: {
  medicineId: string | null;
  initial?: MedicineFormValue;
  categories: CategoryOption[];
}) {
  const action = saveAdminMedicineAction.bind(null, medicineId);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Medicine master record
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Saving or editing a product returns it to pending review. Approval is
          a separate permission checked in the database.
        </p>
      </div>
      {initial && initial.medicine_status === "approved" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950 sm:col-span-2">
          This approved record will become pending after the edit. Existing
          public listings will pause until a reviewer approves the updated
          details.
        </p>
      )}
      <Field
        label="Product name"
        name="product_name"
        defaultValue={initial?.product_name ?? ""}
        maxLength={240}
      />
      <Field
        label="Brand name (optional)"
        name="brand_name"
        defaultValue={initial?.brand_name ?? ""}
        maxLength={240}
        required={false}
      />
      <Field
        label="Composition"
        name="composition"
        defaultValue={initial?.composition ?? ""}
        maxLength={240}
      />
      <Field
        label="Strength"
        name="strength"
        defaultValue={initial?.strength ?? ""}
        maxLength={120}
      />
      <Field
        label="Manufacturer"
        name="manufacturer"
        defaultValue={initial?.manufacturer_name ?? ""}
        maxLength={200}
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Category (optional)
        <select
          name="category_id"
          defaultValue={initial?.category_id ?? ""}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Medicine type
        <select
          name="medicine_type"
          defaultValue={initial?.medicine_type ?? "tablet"}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          {[
            "tablet",
            "capsule",
            "syrup",
            "injection",
            "ointment",
            "drops",
            "inhaler",
            "device",
            "other",
          ].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Prescription classification
        <select
          name="prescription_class"
          defaultValue={initial?.prescription_class ?? "unknown"}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="unknown">Unknown</option>
          <option value="prescription">Prescription</option>
          <option value="otc">OTC</option>
        </select>
      </label>
      <Field
        label="Packaging (optional)"
        name="packaging"
        defaultValue={initial?.packaging ?? ""}
        maxLength={160}
        required={false}
      />
      <label className="flex items-start gap-3 rounded-xl bg-teal-50 p-4 text-sm leading-6 text-teal-950 sm:col-span-2">
        <input
          type="checkbox"
          name="public_visibility"
          defaultChecked={initial?.public_visibility ?? true}
          className="mt-1 size-4 accent-teal-800"
        />
        <span>
          <strong className="font-semibold">Public visibility</strong>
          <span className="block text-xs">
            An approved medicine may appear in public results when its partner
            inventory is also public and in stock.
          </span>
        </span>
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900 sm:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : initial
              ? "Save changes for review"
              : "Create medicine for review"}
        </Button>
      </div>
    </form>
  );
}
