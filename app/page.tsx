import Link from "next/link";

import { Brand } from "@/components/brand/brand";
import { BusinessDirectoryCard } from "@/components/business/business-directory-card";
import { HomeSearch } from "@/components/search/home-search";
import { Button } from "@/components/ui/button";
import { getMedicineCategories } from "@/services/medicine-search";
import { listPublicBusinesses } from "@/services/business-directory";
import { listPublicRedirectWebsites } from "@/services/redirect-websites";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, directory, redirectWebsites] = await Promise.all([
    getMedicineCategories(),
    listPublicBusinesses(),
    listPublicRedirectWebsites(),
  ]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f7fbfa_0%,_#ffffff_55%,_#f4f9f7_100%)] px-4 py-4 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm sm:px-6">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center gap-1 sm:gap-2"
          >
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/medicines">Find Medicine</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/pharmacies">Pharmacies</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/doctors">Doctor appointments</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
            >
              <Link href="/about">About</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
            >
              <Link href="/blog">Blog</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
            >
              <Link href="/contact">Contact</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Sign up</Link>
            </Button>
          </nav>
        </header>

        <section className="relative my-5 overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_90%_5%,_rgba(92,220,164,0.3),_transparent_35%),linear-gradient(120deg,_#0d4e55_0%,_#126f68_53%,_#1a8c63_100%)] px-5 py-12 text-white shadow-[0_28px_80px_-45px_rgba(15,76,78,0.7)] sm:px-10 sm:py-16 lg:px-14 lg:py-20">
          <div className="relative z-10 max-w-3xl">
            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-teal-50 uppercase">
              India’s Medicine Availability Network
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-[-0.045em] sm:text-6xl">
              Find your medicines nearby.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-teal-50 sm:text-lg">
              Search partner-reported availability at approved pharmacies,
              clinics and nursing homes. Call to confirm before you travel.
            </p>
            <div className="mt-8 rounded-2xl bg-white p-2 shadow-xl sm:p-3">
              <HomeSearch />
            </div>
            <p className="mt-3 text-xs leading-5 text-teal-50">
              Find Medicines. Find Nearby. · Search does not place an order or
              recommend substitutions.
            </p>
          </div>
        </section>

        <section aria-labelledby="benefits-title" className="py-7 sm:py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-800">
                A more informed visit
              </p>
              <h2
                id="benefits-title"
                className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Availability, with clarity
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-teal-800 hover:underline"
              href="/about"
            >
              How DawaSetu works
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Partner reported",
                "Availability updates come from participating businesses.",
              ],
              [
                "Nearby options",
                "Sort search results by distance with a one-time location request.",
              ],
              [
                "Approved partners",
                "Listings are limited to businesses reviewed by DawaSetu.",
              ],
              [
                "Confirm before travel",
                "Call or message the pharmacy because stock can change.",
              ],
            ].map(([title, text]) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {categories.length > 0 && (
          <section aria-labelledby="categories-title" className="py-7 sm:py-10">
            <div className="mb-5">
              <p className="text-sm font-semibold text-teal-800">
                Browse by care area
              </p>
              <h2
                id="categories-title"
                className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Medicine categories
              </h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/medicines?category=${encodeURIComponent(category.slug)}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="my-7 rounded-3xl border border-teal-100 bg-teal-50/70 p-5 sm:my-10 sm:p-8"
        >
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-teal-800">Simple steps</p>
            <h2
              id="how-title"
              className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
            >
              How DawaSetu works
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              [
                "01",
                "Search medicine",
                "Look up a brand, medicine name, strength or composition.",
              ],
              [
                "02",
                "Check nearby",
                "See participating businesses that report a matching item.",
              ],
              [
                "03",
                "Contact the partner",
                "Call, message or get directions, then confirm availability.",
              ],
            ].map(([step, title, text]) => (
              <article
                key={step}
                className="rounded-2xl border border-white bg-white p-5"
              >
                <span className="text-sm font-bold tracking-wider text-teal-700">
                  {step}
                </span>
                <h3 className="mt-2 font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="partners-title" className="py-7 sm:py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-800">
                Local network
              </p>
              <h2
                id="partners-title"
                className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Partners reporting availability
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/pharmacies">Browse pharmacies</Link>
            </Button>
          </div>
          {directory.status === "ready" && directory.rows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {directory.rows.slice(0, 3).map((business) => (
                <BusinessDirectoryCard
                  key={business.business_id}
                  business={business}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
              <h3 className="font-semibold text-slate-900">
                {directory.status === "unconfigured"
                  ? "Live availability is not connected in this deployment"
                  : directory.status === "error"
                    ? "Partner availability is temporarily unavailable"
                    : "No partner availability has been reported yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                DawaSetu only shows verified businesses with public availability
                enabled and current medicine reports.
              </p>
            </div>
          )}
        </section>

        {redirectWebsites.length > 0 && (
          <section
            aria-labelledby="health-services-title"
            className="my-8 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,_#f0f9ff_0%,_#f0fdfa_100%)] px-5 py-7 sm:px-8 sm:py-9"
          >
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-sky-800">
                Appointments and health services
              </p>
              <h2
                id="health-services-title"
                className="mt-1 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Find a related service
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These services are provided by external websites. DawaSetu does
                not book appointments or verify their availability.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {redirectWebsites.map((website) => (
                <article
                  key={website.redirect_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
                    External service
                  </p>
                  <h3 className="mt-2 font-semibold text-slate-950">
                    {website.website_name}
                  </h3>
                  {website.description && (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {website.description}
                    </p>
                  )}
                  <a
                    href={website.website_url}
                    target={website.open_in_new_tab ? "_blank" : undefined}
                    rel={
                      website.open_in_new_tab
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    {website.button_text}
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="my-8 flex flex-col gap-4 rounded-3xl border border-teal-100 bg-white px-5 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-sm font-semibold text-teal-800">
              Doctor appointments
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Find a doctor and continue to booking.
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Appointment details are provided by Click2Book. DawaSetu does not
              confirm availability.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/doctors">Browse doctor profiles</Link>
          </Button>
        </section>

        <section className="my-8 rounded-3xl bg-slate-900 px-5 py-8 text-white sm:px-8 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-300">
                Pharmacies · Clinics · Nursing homes
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Help your community find what is available.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Register your business for review. Public listings and inventory
                visibility are enabled only after approval.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg">
              <Link href="/signup">Join the network</Link>
            </Button>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 py-6 text-xs text-slate-500">
          <p>DawaSetu · India’s Medicine Availability Network</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-teal-800">
              About
            </Link>
            <Link href="/blog" className="hover:text-teal-800">
              Blog
            </Link>
            <Link href="/contact" className="hover:text-teal-800">
              Contact
            </Link>
            <Link href="/login" className="hover:text-teal-800">
              Account
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
