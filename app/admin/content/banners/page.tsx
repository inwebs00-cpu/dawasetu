import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { HomepageBannerForm } from "@/components/admin/homepage-banner-form";
import { HomepageBannerPublishToggle } from "@/components/admin/homepage-banner-publish-toggle";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import {
  homepageBannerImageUrl,
  type AdminHomepageBanner,
} from "@/services/homepage-banners";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage banners" };

export default async function AdminHomepageBannersPage() {
  const { supabase } = await requirePlatformPermission("content.manage");
  const { data, error } = await supabase.rpc("admin_list_homepage_banners");
  const banners = (Array.isArray(data) ? data : []) as AdminHomepageBanner[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Dashboard</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/content">Content</Link>
            </Button>
          </div>
        </header>
        <div>
          <p className="text-sm font-semibold text-teal-800">
            Content management
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Homepage banners
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Add campaign banners, choose where they lead, set their order, and
            publish or pause them. Active banners appear above the homepage
            search section.
          </p>
        </div>

        <HomepageBannerForm />

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Banner records are temporarily unavailable. Confirm that the
            homepage banner migration has been applied.
          </p>
        ) : banners.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                title="No additional banners yet"
                description="The DawaSetu launch banner is managed with the site. Upload additional banners using the form above."
              />
            </CardContent>
          </Card>
        ) : (
          <section aria-labelledby="saved-banners-title" className="grid gap-4">
            <h2
              id="saved-banners-title"
              className="text-xl font-semibold text-slate-950"
            >
              Saved banners
            </h2>
            {banners.map((banner) => (
              <Card key={banner.banner_id}>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:p-5">
                  <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-slate-100">
                    <Image
                      src={homepageBannerImageUrl(banner.image_path)}
                      alt={banner.alt_text}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 560px"
                      className="object-contain"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">
                          {banner.title}
                        </h3>
                        <StatusBadge
                          status={banner.is_active ? "published" : "inactive"}
                        />
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        {banner.alt_text}
                      </p>
                      {banner.target_url && (
                        <p className="mt-2 text-xs break-all text-slate-500">
                          Destination: {banner.target_url}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Order {banner.display_order} · Added{" "}
                        {new Date(banner.created_at).toLocaleDateString(
                          "en-IN",
                        )}
                      </p>
                    </div>
                    <HomepageBannerPublishToggle
                      bannerId={banner.banner_id}
                      isActive={banner.is_active}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
