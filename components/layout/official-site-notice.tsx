"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function OfficialSiteNotice() {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let removeTimer: number | undefined;
    const close = () => {
      setClosing(true);
      removeTimer = window.setTimeout(() => setVisible(false), 240);
    };
    const dismissTimer = window.setTimeout(close, 3000);

    return () => {
      window.clearTimeout(dismissTimer);
      if (removeTimer !== undefined) window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    setClosing(true);
    window.setTimeout(() => setVisible(false), 240);
  }

  return (
    <div
      className="official-domain-notice fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]"
      data-closing={closing}
      role="status"
      aria-live="polite"
    >
      <section className="relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25">
        <div
          aria-hidden="true"
          className="h-2 bg-gradient-to-r from-teal-700 via-emerald-500 to-lime-400"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close website notice"
          className="absolute top-5 right-5 grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        <div className="p-6 sm:p-8">
          <p className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold tracking-wide text-emerald-800">
            OFFICIAL WEBSITE UPDATE
          </p>
          <h2 className="pr-10 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            DawaSetu is now at
          </h2>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
            <a
              href="https://dawasetu.online"
              className="break-all text-2xl font-black tracking-tight text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 sm:text-3xl"
            >
              dawasetu.online
            </a>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              <strong>dawasetu.co.in</strong> is no longer DawaSetu’s official
              website. Please use <strong>dawasetu.online</strong> for DawaSetu.
            </p>
          </div>

          <div
            lang="hi"
            className="official-notice-hindi mt-3 rounded-2xl bg-slate-50 p-5 text-[1.05rem] leading-8 text-slate-800"
          >
            <p className="font-bold text-emerald-900">
              DawaSetu की आधिकारिक वेबसाइट अब dawasetu.online है।
            </p>
            <p className="mt-1">
              dawasetu.co.in अब DawaSetu की आधिकारिक वेबसाइट नहीं है। कृपया
              DawaSetu के लिए dawasetu.online का उपयोग करें।
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="mt-5 min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            Continue to DawaSetu · आगे बढ़ें
          </button>
        </div>
      </section>
    </div>
  );
}
