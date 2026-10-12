import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { getPublicSameCompositionMedicines } from "@/services/medicine-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Medicines with the same composition",
};

type PageParams = Promise<{ medicineId: string }>;

export default async function MedicineAlternativesPage({
  params,
}: {
  params: PageParams;
}) {
  const { medicineId } = await params;
  const result = await getPublicSameCompositionMedicines(medicineId);
  const reference = result.status === "ready" ? result.rows[0] : undefined;
  const alternatives =
    result.status === "ready"
      ? result.rows.filter((row) => row.alternative_medicine_id)
      : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/medicines">Medicine search</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Medicine details</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Same composition
        </h1>
        {result.status === "unconfigured" ? (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="Medicine information is not connected"
                description="Configure Supabase and apply the DawaSetu migrations to view approved medicine records."
              />
            </CardContent>
          </Card>
        ) : result.status === "error" || !reference ? (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="Medicine information is unavailable"
                description="This medicine may have been removed from the public catalog. Return to search for current approved medicines."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mt-6">
              <CardHeader>
                <p className="text-sm font-medium text-teal-800">
                  Selected medicine
                </p>
                <CardTitle>{reference.reference_product_name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-slate-900">
                    Composition:
                  </span>{" "}
                  {reference.reference_composition}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Strength:</span>{" "}
                  {reference.reference_strength}
                </p>
              </CardContent>
            </Card>
            <section className="mt-7">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-950">
                  Other approved catalog entries with this composition
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  These entries share a recorded composition. Strengths or
                  product details can differ; check each listing carefully.
                </p>
              </div>
              {alternatives.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <EmptyState
                      title="No other public catalog entries found"
                      description="There are no other approved medicines with this composition in the current public catalog."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {alternatives.map((item) => (
                    <Card key={item.alternative_medicine_id}>
                      <CardHeader>
                        <p className="text-xs font-semibold text-teal-800">
                          Same composition
                        </p>
                        <CardTitle>
                          {item.alternative_brand_name ||
                            item.alternative_product_name}
                        </CardTitle>
                        {item.alternative_brand_name &&
                          item.alternative_brand_name !==
                            item.alternative_product_name && (
                            <p className="text-sm text-slate-600">
                              {item.alternative_product_name}
                            </p>
                          )}
                      </CardHeader>
                      <CardContent>
                        <dl className="grid gap-2 text-sm text-slate-700">
                          <div>
                            <dt className="inline font-medium text-slate-900">
                              Composition:{" "}
                            </dt>
                            <dd className="inline">
                              {item.alternative_composition}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-medium text-slate-900">
                              Strength:{" "}
                            </dt>
                            <dd className="inline">
                              {item.alternative_strength}
                            </dd>
                          </div>
                          {item.alternative_manufacturer && (
                            <div>
                              <dt className="inline font-medium text-slate-900">
                                Manufacturer:{" "}
                              </dt>
                              <dd className="inline">
                                {item.alternative_manufacturer}
                              </dd>
                            </div>
                          )}
                        </dl>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mt-4"
                        >
                          <Link
                            href={`/medicines?q=${encodeURIComponent(item.alternative_product_name ?? "")}`}
                          >
                            Search nearby availability
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              DawaSetu does not recommend medicine substitution. Confirm any
              change with a doctor or pharmacist. For prescription medicines,
              always follow their advice.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
