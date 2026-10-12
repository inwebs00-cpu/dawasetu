"use client";

import { useActionState } from "react";

import {
  addInventoryItemAction,
  searchMedicineMasterAction,
  submitPartnerMedicineAction,
  updateInventoryStatusAction,
  type InventorySearchState,
  type MedicineMasterOption,
} from "@/app/partner/[businessId]/inventory/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuthActionState } from "@/types/auth";

interface CategoryOption {
  id: string;
  name: string;
}

function StateMessage({ state }: { state: AuthActionState }) {
  if (state.error)
    return (
      <p
        role="alert"
        className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800"
      >
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p
        role="status"
        className="rounded-lg bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-900"
      >
        {state.message}
      </p>
    );
  return null;
}

function AddInventoryButton({
  businessId,
  medicine,
}: {
  businessId: string;
  medicine: MedicineMasterOption;
}) {
  const action = addInventoryItemAction.bind(
    null,
    businessId,
    medicine.medicine_id,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="mt-3 grid gap-2">
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add to inventory"}
      </Button>
      <StateMessage state={state} />
    </form>
  );
}

export function MedicineMasterSearch({ businessId }: { businessId: string }) {
  const action = searchMedicineMasterAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState<
    InventorySearchState,
    FormData
  >(action, {});
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">
        Add an approved medicine
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Search the central medicine master. New products can be submitted for
        review below.
      </p>
      <form
        action={formAction}
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
      >
        <label htmlFor="medicine-master-query" className="sr-only">
          Search the medicine master
        </label>
        <Input
          id="medicine-master-query"
          name="query"
          placeholder="Brand, product, composition or manufacturer"
          minLength={2}
          maxLength={120}
          required
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Searching…" : "Search medicines"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {state.error}
        </p>
      )}
      {state.results && state.results.length === 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          No matching approved product was found. You can submit a new medicine
          for verification.
        </p>
      )}
      {state.results && state.results.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {state.results.map((medicine) => (
            <MedicineMasterResult
              key={medicine.medicine_id}
              businessId={businessId}
              medicine={medicine}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MedicineMasterResult({
  businessId,
  medicine,
}: {
  businessId: string;
  medicine: MedicineMasterOption;
}) {
  const isApproved = medicine.medicine_status === "approved";
  return (
    <article className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-950">
            {medicine.product_name}
          </h3>
          <StatusBadge status={medicine.medicine_status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {medicine.brand_name ? `${medicine.brand_name} · ` : ""}
          {medicine.strength}
        </p>
        {medicine.composition && (
          <p className="mt-1 text-xs text-slate-500">
            {medicine.composition}
            {medicine.manufacturer_name
              ? ` · ${medicine.manufacturer_name}`
              : ""}
          </p>
        )}
      </div>
      {isApproved ? (
        <div className="w-full max-w-44">
          <AddInventoryButton businessId={businessId} medicine={medicine} />
        </div>
      ) : (
        <p className="max-w-48 text-xs leading-5 text-slate-500">
          Pending verification. Inventory can be added after approval.
        </p>
      )}
    </article>
  );
}

export function UpdateInventoryForm({
  businessId,
  item,
}: {
  businessId: string;
  item: {
    medicine_id: string;
    inventory_status: string;
    quantity: number | null;
    public_visible: boolean;
  };
}) {
  const action = updateInventoryStatusAction.bind(
    null,
    businessId,
    item.medicine_id,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="grid gap-3 rounded-xl bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="grid gap-2 text-xs font-medium text-slate-700">
          Availability
          <select
            name="status"
            defaultValue={item.inventory_status}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          >
            <option value="available">Available</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-medium text-slate-700">
          Quantity (optional)
          <Input
            name="quantity"
            type="number"
            min={0}
            max={1000000}
            step={1}
            defaultValue={item.quantity ?? ""}
            className="h-10"
          />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input
          type="checkbox"
          name="public_visible"
          defaultChecked={item.public_visible}
          className="mt-0.5 size-4 accent-teal-800"
        />
        Show this medicine publicly when the business and medicine are also
        approved and visible.
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save availability"}
      </Button>
      <StateMessage state={state} />
    </form>
  );
}

export function SubmitMedicineForm({
  businessId,
  categories,
}: {
  businessId: string;
  categories: CategoryOption[];
}) {
  const action = submitPartnerMedicineAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-6"
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Suggest a new medicine
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          New products remain pending until an admin verifies the medicine
          master record.
        </p>
      </div>
      <Field
        id="new-medicine-product"
        name="product_name"
        label="Product name"
        maxLength={240}
        required
      />
      <Field
        id="new-medicine-brand"
        name="brand_name"
        label="Brand name (optional)"
        maxLength={240}
      />
      <Field
        id="new-medicine-composition"
        name="composition"
        label="Composition"
        maxLength={240}
        required
      />
      <Field
        id="new-medicine-strength"
        name="strength"
        label="Strength"
        maxLength={120}
        required
      />
      <Field
        id="new-medicine-manufacturer"
        name="manufacturer"
        label="Manufacturer"
        maxLength={200}
        required
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Medicine type
        <select
          name="medicine_type"
          required
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="">Choose type</option>
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
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Prescription classification
        <select
          name="prescription_class"
          required
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="unknown">Unknown</option>
          <option value="prescription">Prescription</option>
          <option value="otc">OTC</option>
        </select>
      </label>
      <Field
        id="new-medicine-packaging"
        name="packaging"
        label="Packaging (optional)"
        maxLength={160}
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Category (optional)
        <select
          name="category_id"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 sm:col-span-2"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900 sm:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit medicine for verification"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  maxLength,
  required = false,
}: {
  id: string;
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-sm font-medium text-slate-800"
    >
      {label}
      <Input id={id} name={name} maxLength={maxLength} required={required} />
    </label>
  );
}
