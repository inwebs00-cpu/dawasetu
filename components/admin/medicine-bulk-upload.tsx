"use client";

import { useActionState } from "react";

import {
  bulkImportAdminMedicinesAction,
  type MedicineBulkImportState,
} from "@/app/admin/medicines/actions";
import { Button } from "@/components/ui/button";

export function MedicineBulkUpload() {
  const [state, formAction, pending] = useActionState<
    MedicineBulkImportState,
    FormData
  >(bulkImportAdminMedicinesAction, {});

  return (
    <section className="mt-6 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold text-teal-800">
            Catalog administration
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Bulk upload medicines
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Upload up to 500 rows. Imported products enter the medicine master
            as pending review; they will not appear in public search until an
            authorized admin approves them.
          </p>
        </div>
        <a
          href="/templates/admin-medicine-template.csv"
          download
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-teal-800 px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-50"
        >
          Download CSV template
        </a>
      </div>

      <form
        action={formAction}
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Medicine CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:font-semibold file:text-teal-900"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload medicines"}
        </Button>
      </form>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Required columns: product_name, composition, strength, manufacturer.
        Optional: brand_name, category_slug, medicine_type, prescription_class,
        packaging, public_visibility.
      </p>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-950"
        >
          {state.message}
        </p>
      )}
      {state.rows && state.rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">CSV row</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.rows.map((row) => (
                <tr key={`${row.line}:${row.result}:${row.message}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {row.line}
                  </td>
                  <td className="px-4 py-3 text-slate-700 capitalize">
                    {row.result}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
