"use client";

import { useActionState } from "react";

import { registerBusinessAction } from "@/app/partner/register/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

interface BusinessTypeOption {
  id: string;
  name: string;
}

interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

function Field({
  id,
  label,
  name,
  type = "text",
  required = false,
  maxLength,
  placeholder,
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-sm font-medium text-slate-800"
    >
      {label}
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}

export function BusinessRegistrationForm({
  businessTypes,
  areas,
}: {
  businessTypes: BusinessTypeOption[];
  areas: AreaOption[];
}) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    registerBusinessAction,
    {},
  );

  return (
    <form action={action} className="grid gap-7">
      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-slate-950 sm:col-span-2">
          Business details
        </h2>
        <Field
          id="business-name"
          name="business_name"
          label="Business name"
          required
          maxLength={200}
        />
        <label
          htmlFor="business-type"
          className="grid gap-2 text-sm font-medium text-slate-800"
        >
          Business type
          <select
            id="business-type"
            name="business_type_id"
            required
            className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          >
            <option value="">Choose a type</option>
            {businessTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          id="business-registration"
          name="registration_number"
          label="Registration / pharmacy licence number"
          maxLength={100}
        />
        <Field
          id="business-email"
          name="email"
          label="Business email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
        <Field
          id="business-phone"
          name="phone"
          label="Business phone"
          type="tel"
          required
          maxLength={20}
          placeholder="10-digit number or +country code"
          autoComplete="tel"
        />
        <Field
          id="business-whatsapp"
          name="whatsapp"
          label="WhatsApp (optional)"
          type="tel"
          maxLength={20}
          placeholder="10-digit number or +country code"
        />
        <div className="sm:col-span-2">
          <Field
            id="business-description"
            name="description"
            label="Short description"
            maxLength={1000}
            placeholder="What should customers know about this business?"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-slate-950 sm:col-span-2">
          Location
        </h2>
        <div className="sm:col-span-2">
          <Field
            id="business-address"
            name="address_line1"
            label="Street address"
            required
            maxLength={240}
            autoComplete="street-address"
          />
        </div>
        {areas.length > 0 ? (
          <label
            htmlFor="business-area-id"
            className="grid gap-2 text-sm font-medium text-slate-800"
          >
            Area / locality
            <select
              id="business-area-id"
              name="area_id"
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
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
        ) : (
          <Field
            id="business-area"
            name="area"
            label="Area / locality"
            maxLength={100}
          />
        )}
        <Field
          id="business-district"
          name="district"
          label="District"
          maxLength={100}
        />
        <Field
          id="business-state"
          name="state"
          label="State / Union Territory"
          maxLength={100}
        />
        <Field
          id="business-pin"
          name="postal_code"
          label="PIN code"
          maxLength={6}
          inputMode="numeric"
        />
        <Field
          id="business-latitude"
          name="latitude"
          label="Latitude (optional)"
          type="number"
          maxLength={20}
        />
        <Field
          id="business-longitude"
          name="longitude"
          label="Longitude (optional)"
          type="number"
          maxLength={20}
        />
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold text-slate-950">Opening hours</h2>
        <Field
          id="business-hours"
          name="opening_hours"
          label="Hours and closed days"
          maxLength={1000}
          placeholder="For example: Mon–Sat 9:00–18:00; Sunday closed"
        />
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Your business will remain pending until reviewed. Public availability
        starts off and distributor inventory is not part of this registration.
      </div>
      {areas.length === 0 && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Area matching is not configured yet. You can still register, but
          location-based medicine requests will begin matching after your area
          is added to DawaSetu.
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending || businessTypes.length === 0}>
        {pending ? "Submitting registration…" : "Submit for review"}
      </Button>
      {businessTypes.length === 0 && (
        <p className="text-sm text-slate-600">
          No active partner business types are configured yet. Please contact
          DawaSetu support.
        </p>
      )}
    </form>
  );
}
