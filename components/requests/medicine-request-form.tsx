"use client";

import { useActionState } from "react";

import { createMedicineRequestAction } from "@/app/requests/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

export function MedicineRequestForm({
  medicineId,
  medicineName,
  composition,
  strength,
  areas,
}: {
  medicineId: string;
  medicineName: string;
  composition: string;
  strength: string;
  areas: AreaOption[];
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(createMedicineRequestAction, {});
  return (
    <form
      action={formAction}
      className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
    >
      <input type="hidden" name="medicine_id" value={medicineId} />
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Request this medicine
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Your request is sent to approved public partners in your mapped area.
          Partners see the medicine, quantity, and approximate area, but not
          your phone number or exact address.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Medicine name
        <Input
          name="medicine_name"
          required
          maxLength={240}
          defaultValue={medicineName}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Composition (optional)
        <Input name="composition" maxLength={240} defaultValue={composition} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Strength (optional)
        <Input name="strength" maxLength={120} defaultValue={strength} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Quantity
        <Input
          name="quantity"
          type="number"
          min={1}
          max={100}
          step={1}
          defaultValue={1}
          required
        />
      </label>
      {areas.length > 0 ? (
        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Your nearby area
          <select
            name="area_id"
            required
            defaultValue=""
            className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          >
            <option value="">Choose your area</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
                {area.postal_code ? ` · ${area.postal_code}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950 sm:col-span-2">
          Area matching is not configured yet, so DawaSetu cannot route requests
          to nearby partners.
        </p>
      )}
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Note (optional)
        <textarea
          name="note"
          maxLength={1000}
          rows={3}
          placeholder="Any useful detail for the pharmacy"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
        Partner responses appear in your account. Requests expire after 24
        hours. This is an availability inquiry; it does not reserve or sell
        medicine.
      </p>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2"
        >
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || areas.length === 0}>
          {pending ? "Sending request…" : "Send medicine request"}
        </Button>
      </div>
    </form>
  );
}
