"use client";

import { useActionState } from "react";

import { updateBusinessProfileAction } from "@/app/partner/[businessId]/profile/actions";
import {
  LocationPicker,
  type InitialAreaOption,
} from "@/components/forms/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  LocationDistrictOption,
  LocationStateOption,
} from "@/services/location-directory";
import type { AuthActionState } from "@/types/auth";

interface BusinessProfile {
  business_name: string;
  phone_e164: string;
  whatsapp_e164: string | null;
  email: string | null;
  address_line1: string;
  address_line2: string | null;
  area_id: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  opening_hours: { schedule?: string };
  google_business_url: string | null;
  public_availability_enabled: boolean;
  status: string;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  maxLength,
  required = false,
  autoComplete,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  type?: string;
  maxLength?: number;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        autoComplete={autoComplete}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}

export function BusinessProfileForm({
  businessId,
  business,
  states,
  districts,
  initialArea,
}: {
  businessId: string;
  business: BusinessProfile;
  states: LocationStateOption[];
  districts: LocationDistrictOption[];
  initialArea: InitialAreaOption | null;
}) {
  const action = updateBusinessProfileAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
    >
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Business details
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Updates appear on the public directory only when the business and
          public availability are approved and active.
        </p>
      </div>
      <Field
        label="Business name"
        name="business_name"
        defaultValue={business.business_name}
        maxLength={200}
        required
      />
      <Field
        label="Business phone"
        name="phone"
        defaultValue={business.phone_e164}
        type="tel"
        maxLength={20}
        required
        autoComplete="tel"
      />
      <Field
        label="WhatsApp"
        name="whatsapp"
        defaultValue={business.whatsapp_e164 ?? ""}
        type="tel"
        maxLength={20}
      />
      <Field
        label="Business email"
        name="email"
        defaultValue={business.email ?? ""}
        type="email"
        maxLength={254}
        autoComplete="email"
      />
      <div className="sm:col-span-2">
        <Field
          label="Street address"
          name="address_line1"
          defaultValue={business.address_line1}
          maxLength={240}
          required
          autoComplete="street-address"
        />
      </div>
      <Field
        label="Address details"
        name="address_line2"
        defaultValue={business.address_line2 ?? ""}
        maxLength={240}
      />
      {districts.length > 0 ? (
        <LocationPicker
          states={states}
          districts={districts}
          initialArea={initialArea}
          initialPostalCode={business.postal_code ?? ""}
          label="Mapped business area"
        />
      ) : (
        <div className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950">
          No DawaSetu areas are configured yet. Location-based requests will not
          be matched to this business.
        </div>
      )}
      <Field
        label="Latitude (optional)"
        name="latitude"
        defaultValue={business.latitude ?? ""}
        type="number"
      />
      <Field
        label="Longitude (optional)"
        name="longitude"
        defaultValue={business.longitude ?? ""}
        type="number"
      />
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Description
        <Input
          name="description"
          defaultValue={business.description ?? ""}
          maxLength={1000}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Opening hours
        <Input
          name="opening_hours"
          defaultValue={business.opening_hours?.schedule ?? ""}
          maxLength={1000}
          placeholder="Mon–Sat 9:00–18:00; Sunday closed"
        />
      </label>
      <div className="sm:col-span-2">
        <Field
          label="Google Business profile URL (optional)"
          name="google_business_url"
          defaultValue={business.google_business_url ?? ""}
          type="url"
          maxLength={1000}
        />
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-950 sm:col-span-2">
        <input
          type="checkbox"
          name="public_availability_enabled"
          defaultChecked={business.public_availability_enabled}
          disabled={business.status !== "approved"}
          className="mt-1 size-4 accent-teal-800"
        />
        <span>
          <strong className="font-semibold">
            Show public medicine availability
          </strong>
          <span className="block text-xs text-teal-900">
            When enabled, individual approved medicines must also be marked
            public and in stock.
          </span>
          {business.status !== "approved" && (
            <span className="block text-xs text-amber-900">
              Available after the business is approved.
            </span>
          )}
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
          {pending ? "Saving profile…" : "Save business profile"}
        </Button>
      </div>
    </form>
  );
}
