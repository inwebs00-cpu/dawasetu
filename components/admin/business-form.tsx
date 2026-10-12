"use client";

import { useActionState } from "react";

import { createBusinessAction } from "@/app/admin/partners/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

interface Option {
  id: string;
  name: string;
}
interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <Input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}

export function BusinessForm({
  types,
  areas,
}: {
  types: Option[];
  areas: AreaOption[];
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(createBusinessAction, {});
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Business details
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          The owner must already have an active DawaSetu account. New businesses
          stay pending until reviewed.
        </p>
      </div>
      <Field
        label="Owner account email"
        name="owner_email"
        type="email"
        required
        maxLength={254}
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Business type
        <select
          name="business_type_id"
          required
          defaultValue=""
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="">Choose a type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Business name"
        name="business_name"
        required
        maxLength={200}
      />
      <Field
        label="Registration / licence reference"
        name="registration_number"
        maxLength={100}
      />
      <Field
        label="Business phone"
        name="phone"
        type="tel"
        required
        maxLength={20}
      />
      <Field
        label="WhatsApp (optional)"
        name="whatsapp"
        type="tel"
        maxLength={20}
      />
      <Field
        label="Business email (optional)"
        name="email"
        type="email"
        maxLength={254}
      />
      <Field
        label="Street address"
        name="address_line1"
        required
        maxLength={240}
      />
      <Field label="Address details" name="address_line2" maxLength={240} />
      {areas.length > 0 && (
        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Mapped area
          <select
            name="area_id"
            defaultValue=""
            className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
          >
            <option value="">Choose an area (optional)</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
                {area.postal_code ? ` · ${area.postal_code}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <Field label="PIN code" name="postal_code" maxLength={6} />
      <Field label="Latitude (optional)" name="latitude" type="number" />
      <Field label="Longitude (optional)" name="longitude" type="number" />
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Business description
        <textarea
          name="description"
          maxLength={1000}
          rows={3}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-normal"
        />
      </label>
      <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:col-span-2">
        Distributor inventory remains B2B-only. All new businesses begin
        pending, and public availability starts off.
      </p>
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
        <Button type="submit" disabled={pending || types.length === 0}>
          {pending ? "Creating business…" : "Create pending business"}
        </Button>
      </div>
    </form>
  );
}
