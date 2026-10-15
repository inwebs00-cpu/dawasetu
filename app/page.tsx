import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Clock3,
  HeartPulse,
  MapPin,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  type LucideIcon,
} from "lucide-react";

import { Brand } from "@/components/brand/brand";
import { BusinessDirectoryCard } from "@/components/business/business-directory-card";
import { HomeSearch } from "@/components/search/home-search";
import { Button } from "@/components/ui/button";
import {
  getMedicineCategories,
  type MedicineCategory,
} from "@/services/medicine-search";
import { listPublicBusinesses } from "@/services/business-directory";
import { listPublicRedirectWebsites } from "@/services/redirect-websites";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find Medicines Nearby | DawaSetu India",
  description:
    "Search medicines by brand, composition or strength and check partner-reported availability at approved nearby pharmacies in India.",
  keywords: [
    "find medicines nearby",
    "medicine availability India",
    "nearby pharmacy medicine stock",
    "search medicine by composition",
    "DawaSetu",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "DawaSetu — Find Medicines. Find Nearby.",
    description:
      "Check partner-reported medicine availability at approved nearby pharmacies across India.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DawaSetu — Find Medicines. Find Nearby.",
    description:
      "Search medicines and check partner-reported availability at nearby pharmacies.",
  },
};

const benefits: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}[] = [
  {
    icon: Activity,
    title: "Partner reported",
    description: "See availability shared by participating businesses.",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: MapPin,
    title: "Search nearby",
    description: "Use your location once to sort results by distance.",
    tone: "bg-sky-50 text-sky-700",
  },
  {
    icon: BadgeCheck,
    title: "Reviewed partners",
    description: "Public listings are limited to approved businesses.",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    icon: Clock3,
    title: "Save a trip",
    description: "Call the pharmacy to confirm before you travel.",
    tone: "bg-violet-50 text-violet-700",
  },
];

const steps = [
  {
    number: "01",
    title: "Search a medicine",
    description: "Look up a brand, product, strength or composition.",
    icon: Pill,
    tone: "bg-sky-100 text-sky-700",
  },
  {
    number: "02",
    title: "Check nearby",
    description: "See partner reports and sort them by distance.",
    icon: MapPin,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    number: "03",
    title: "Contact the pharmacy",
    description: "Call or message to confirm the latest stock status.",
    icon: Store,
    tone: "bg-orange-100 text-orange-700",
  },
  {
    number: "04",
    title: "Choose your next step",
    description: "Get directions and speak with a pharmacist if needed.",
    icon: HeartPulse,
    tone: "bg-violet-100 text-violet-700",
  },
];

const defaultCategories: MedicineCategory[] = [
  { slug: "pain-relief", name: "Pain Relief" },
  { slug: "antibiotics", name: "Antibiotics" },
  { slug: "diabetes-care", name: "Diabetes Care" },
  { slug: "cardiac-care", name: "Cardiac Care" },
  { slug: "vitamins-supplements", name: "Vitamins & Supplements" },
  { slug: "respiratory-care", name: "Respiratory Care" },
  { slug: "gastro-care", name: "Gastro Care" },
  { slug: "skin-care", name: "Skin Care" },
];

function categoryStyle(name: string) {
  const value = name.toLowerCase();
  if (/heart|cardiac|blood pressure/.test(value)) {
    return { icon: HeartPulse, tone: "bg-rose-50 text-rose-600" };
  }
  if (/diabetes|sugar/.test(value)) {
    return { icon: Activity, tone: "bg-sky-50 text-sky-700" };
  }
  if (/vitamin|supplement|nutrition/.test(value)) {
    return { icon: ShieldCheck, tone: "bg-lime-50 text-lime-700" };
  }
  if (/respiratory|breath|lung|cold|cough/.test(value)) {
    return { icon: Activity, tone: "bg-cyan-50 text-cyan-700" };
  }
  if (/skin|derma/.test(value)) {
    return { icon: Sparkles, tone: "bg-orange-50 text-orange-700" };
  }
  return { icon: Pill, tone: "bg-teal-50 text-teal-700" };
}

function HeroMapIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[1.08] w-full max-w-[490px] overflow-hidden rounded-[2rem] border border-white/80 bg-[radial-gradient(ellipse_at_70%_20%,_rgba(74,195,157,0.24),_transparent_34%),linear-gradient(140deg,_#dff3f2_0%,_#edf8fb_55%,_#d4eeea_100%)] shadow-[0_28px_70px_-38px_rgba(17,78,80,0.5)]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(255,255,255,0.36)_1px,_transparent_1px),linear-gradient(rgba(255,255,255,0.36)_1px,_transparent_1px)] bg-size-[42px_42px]" />
      <div className="absolute -top-14 -right-8 size-64 rounded-full border-[34px] border-white/35" />
      <div className="absolute top-[44%] -left-[8%] h-20 w-[118%] rotate-[-23deg] rounded-[50%] border-y-[18px] border-white/70" />
      <div className="absolute top-[47%] -left-[10%] h-14 w-[120%] rotate-[24deg] rounded-[50%] border-y-[13px] border-[#b6e5d5]/75" />
      <div className="absolute top-[18%] left-[16%] grid size-12 place-items-center rounded-2xl border border-white bg-white text-teal-800 shadow-lg shadow-teal-900/10">
        <Store className="size-5" />
      </div>
      <div className="absolute top-[25%] right-[18%] grid size-14 place-items-center rounded-2xl border border-white bg-white text-emerald-700 shadow-lg shadow-teal-900/10">
        <MapPin className="size-6" />
      </div>
      <div className="absolute bottom-[25%] left-[28%] grid size-11 place-items-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-lg shadow-emerald-900/20">
        <Pill className="size-5 -rotate-45" />
      </div>
      <div className="absolute right-[15%] bottom-[19%] grid size-10 place-items-center rounded-full border-4 border-white bg-sky-600 text-white shadow-lg shadow-sky-900/20">
        <MapPin className="size-4" />
      </div>
      <div className="absolute top-[38%] right-5 max-w-[205px] rounded-2xl border border-white/90 bg-white/95 p-4 shadow-xl shadow-slate-900/10 sm:right-8 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <BadgeCheck className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-900">
              Availability, closer to you
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">
              Check partner updates before you make the trip.
            </span>
          </span>
        </div>
      </div>
      <div className="absolute right-5 bottom-6 left-5 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 sm:right-8 sm:bottom-8 sm:left-8">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-800">
          <ShieldCheck className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            Verified public partners
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">
            Distributor inventory stays private.
          </span>
        </span>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [categories, directory, redirectWebsites] = await Promise.all([
    getMedicineCategories(),
    listPublicBusinesses(),
    listPublicRedirectWebsites(),
  ]);
  const homepageCategories =
    categories.length > 0 ? categories : defaultCategories;

  return (
    <main className="min-h-screen bg-[#f7fbfa] pb-24 text-slate-900 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            <Link href="/" className="nav-link nav-link-active">
              Home
            </Link>
            <Link href="/medicines" className="nav-link">
              Find medicine
            </Link>
            <Link href="/pharmacies" className="nav-link">
              Pharmacies
            </Link>
            <Link href="/about" className="nav-link">
              About
            </Link>
            <Link href="/blog" className="nav-link">
              Blog
            </Link>
            <Link href="/contact" className="nav-link">
              Contact
            </Link>
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/account"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Account
            </Link>
            <Button
              asChild
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Link href="/signup">Join</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <section className="relative isolate mt-5 overflow-hidden rounded-[2rem] border border-[#dceeed] bg-[radial-gradient(ellipse_at_4%_4%,_rgba(255,255,255,0.95),_transparent_42%),linear-gradient(118deg,_#eef8fb_0%,_#e8f6f4_54%,_#e1f3ec_100%)] px-5 py-8 shadow-[0_22px_55px_-42px_rgba(15,62,68,0.46)] sm:mt-7 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
          <div className="pointer-events-none absolute -top-24 left-[43%] size-80 rounded-full bg-white/40 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3.5 py-1.5 text-xs font-bold tracking-[0.12em] text-emerald-800 uppercase shadow-sm">
                <span className="size-2 rounded-full bg-emerald-500" />
                India’s medicine availability network
              </span>
              <h1 className="mt-5 max-w-[700px] text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.06] font-bold tracking-[-0.055em] text-[#12314a]">
                Find your medicines{" "}
                <span className="text-emerald-700">nearby.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
                Check partner-reported availability at nearby pharmacies,
                clinics and nursing homes. Save time and call to confirm before
                you travel.
              </p>
              <div className="mt-7 max-w-2xl">
                <HomeSearch />
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-emerald-700"
                />
                Availability can change. DawaSetu does not sell medicines or
                recommend prescription substitutions.
              </p>
            </div>
            <div className="hidden lg:block">
              <HeroMapIllustration />
            </div>
          </div>
        </section>

        <section
          aria-label="DawaSetu benefits"
          className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4 sm:gap-4 sm:py-8"
        >
          {benefits.map(({ icon: Icon, title, description, tone }) => (
            <article
              key={title}
              className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_25px_-22px_rgba(15,23,42,0.4)] sm:p-5"
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  {title}
                </span>
                <span className="mt-1 hidden text-xs leading-5 text-slate-600 sm:block">
                  {description}
                </span>
              </span>
            </article>
          ))}
        </section>

        {homepageCategories.length > 0 && (
          <section aria-labelledby="categories-title" className="py-7 sm:py-10">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Explore the medicine directory
                </p>
                <h2
                  id="categories-title"
                  className="mt-1 text-2xl font-bold tracking-tight text-[#12314a] sm:text-3xl"
                >
                  Browse by category
                </h2>
              </div>
              <Link
                href="/medicines"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                View all <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {homepageCategories.slice(0, 8).map((category) => {
                const { icon: Icon, tone } = categoryStyle(category.name);
                return (
                  <Link
                    key={category.slug}
                    href={`/medicines?category=${encodeURIComponent(category.slug)}`}
                    className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-5 text-center shadow-[0_8px_22px_-20px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <span
                      className={`grid size-12 place-items-center rounded-2xl transition group-hover:scale-105 ${tone}`}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-sm leading-5 font-semibold text-slate-800">
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section
          aria-labelledby="how-title"
          className="grid gap-5 py-7 lg:grid-cols-[1.5fr_0.9fr] lg:py-10"
        >
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-sm font-semibold text-emerald-800">
              Simple steps
            </p>
            <h2
              id="how-title"
              className="mt-1 text-2xl font-bold tracking-tight text-[#12314a] sm:text-3xl"
            >
              How DawaSetu works
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {steps.map(({ number, title, description, icon: Icon, tone }) => (
                <article key={number} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-[#153d58] text-xs font-bold text-white">
                      {number}
                    </span>
                    <span
                      className={`grid size-11 place-items-center rounded-full ${tone}`}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <aside className="relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(145deg,_#eff9f3_0%,_#e6f6f0_100%)] p-5 sm:p-7">
            <ShieldCheck
              aria-hidden="true"
              className="absolute top-5 right-5 size-12 text-emerald-700/80 sm:size-14"
            />
            <p className="text-sm font-semibold text-emerald-800">
              Your health, your choice
            </p>
            <h2 className="mt-2 max-w-xs text-2xl leading-tight font-bold tracking-tight text-[#12314a]">
              Clear availability. No medical guesswork.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-700">
              DawaSetu helps you connect with a pharmacy. It does not diagnose,
              sell medicines or decide whether one medicine can replace another.
            </p>
            <Link
              href="/about"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            >
              Learn about DawaSetu{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </aside>
        </section>

        <section aria-labelledby="partners-title" className="py-7 sm:py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Local network
              </p>
              <h2
                id="partners-title"
                className="mt-1 text-2xl font-bold tracking-tight text-[#12314a] sm:text-3xl"
              >
                Partner businesses
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Verified pharmacies and care providers with public profiles.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/pharmacies">Browse businesses</Link>
            </Button>
          </div>
          {directory.status === "ready" && directory.rows.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {directory.rows.slice(0, 4).map((business) => (
                <BusinessDirectoryCard
                  key={business.business_id}
                  business={business}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-9 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-800">
                <Store aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">
                {directory.status === "unconfigured"
                  ? "Live partner listings are not connected in this deployment"
                  : directory.status === "error"
                    ? "Partner listings are temporarily unavailable"
                    : "No public partner listings yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Approved businesses appear here when they enable public profile
                visibility. Inventory is shown only when the business and
                medicine are both public.
              </p>
            </div>
          )}
        </section>

        {redirectWebsites.length > 0 && (
          <section
            aria-labelledby="health-services-title"
            className="my-7 rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,_#f0f9ff_0%,_#f0fdfa_100%)] px-5 py-7 sm:px-8 sm:py-9"
          >
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-sky-800">
                Appointments and health services
              </p>
              <h2
                id="health-services-title"
                className="mt-1 text-2xl font-bold tracking-tight text-[#12314a]"
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

        <section className="my-7 flex flex-col gap-5 rounded-[1.75rem] border border-teal-100 bg-white px-5 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div className="flex items-start gap-4">
            <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800 sm:grid">
              <Stethoscope aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-teal-800">
                Doctor appointments
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[#12314a]">
                Find a doctor and continue to booking.
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Appointment details are provided by Click2Book. DawaSetu does
                not confirm availability.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/doctors">Browse doctor profiles</Link>
          </Button>
        </section>

        <section className="my-7 overflow-hidden rounded-[1.75rem] bg-[#123d55] px-5 py-7 text-white sm:px-8 sm:py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-emerald-300">
                Pharmacies · Clinics · Nursing homes
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Help your community find what is available.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Register your business for review. Public listings and inventory
                visibility are enabled only after approval.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="shrink-0">
              <Link href="/signup">Join the network</Link>
            </Button>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-slate-200 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>DawaSetu · India’s Medicine Availability Network</p>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            <Link href="/about" className="hover:text-teal-800">
              About
            </Link>
            <Link href="/blog" className="hover:text-teal-800">
              Blog
            </Link>
            <Link href="/contact" className="hover:text-teal-800">
              Contact
            </Link>
            <Link href="/account" className="hover:text-teal-800">
              My account
            </Link>
          </nav>
        </footer>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed right-3 bottom-3 left-3 z-50 grid grid-cols-4 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden"
      >
        <MobileNavLink href="/" icon={Store} label="Home" current />
        <MobileNavLink href="/medicines" icon={Pill} label="Medicines" />
        <MobileNavLink href="/pharmacies" icon={Store} label="Pharmacies" />
        <MobileNavLink href="/account" icon={ShieldCheck} label="Account" />
      </nav>
    </main>
  );
}

function MobileNavLink({
  href,
  icon: Icon,
  label,
  current = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[0.68rem] font-semibold transition ${current ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
