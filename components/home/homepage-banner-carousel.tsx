"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import type { HomepageBanner } from "@/types/homepage-banner";

function BannerImage({ banner }: { banner: HomepageBanner }) {
  return (
    <Image
      src={banner.image_url}
      alt={banner.alt_text}
      fill
      priority
      unoptimized
      sizes="(max-width: 768px) 100vw, 1280px"
      className="object-contain"
    />
  );
}

export function HomepageBannerCarousel({
  banners,
}: {
  banners: HomepageBanner[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (banners.length < 2 || isPaused) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % banners.length);
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [banners.length, isPaused]);

  if (banners.length === 0) return null;

  const banner = banners[activeIndex] ?? banners[0];
  const content = <BannerImage banner={banner} />;
  const external = banner.target_url?.startsWith("https://") ?? false;

  return (
    <section
      aria-label="DawaSetu announcements"
      className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:mt-6 sm:rounded-[2rem]"
    >
      <div className="relative aspect-[3/2] w-full bg-[#f1f8f6]">
        {banner.target_url ? (
          external ? (
            <a
              href={banner.target_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={banner.title}
              className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-emerald-700"
            >
              {content}
            </a>
          ) : (
            <Link
              href={banner.target_url}
              aria-label={banner.title}
              className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-emerald-700"
            >
              {content}
            </Link>
          )
        ) : (
          content
        )}
      </div>
      {banners.length > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 sm:px-4">
          <p
            className="min-w-0 truncate text-xs font-medium text-slate-600"
            aria-live="polite"
          >
            {banner.title} <span className="text-slate-400">·</span>{" "}
            {activeIndex + 1} of {banners.length}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={
                isPaused
                  ? "Play automatic banner rotation"
                  : "Pause automatic banner rotation"
              }
              aria-pressed={isPaused}
              onClick={() => setIsPaused((paused) => !paused)}
              className="grid size-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              {isPaused ? (
                <Play aria-hidden="true" className="size-4" />
              ) : (
                <Pause aria-hidden="true" className="size-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() =>
                setActiveIndex(
                  (index) => (index - 1 + banners.length) % banners.length,
                )
              }
              className="grid size-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() =>
                setActiveIndex((index) => (index + 1) % banners.length)
              }
              className="grid size-9 place-items-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
