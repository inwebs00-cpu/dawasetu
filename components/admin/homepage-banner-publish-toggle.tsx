"use client";

import { useActionState } from "react";

import { setHomepageBannerActiveAction } from "@/app/admin/content/banners/actions";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/types/auth";

export function HomepageBannerPublishToggle({
  bannerId,
  isActive,
}: {
  bannerId: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(setHomepageBannerActiveAction, {});

  return (
    <div className="grid justify-items-end gap-2">
      <form action={formAction}>
        <input type="hidden" name="banner_id" value={bannerId} />
        <input type="hidden" name="is_active" value={String(!isActive)} />
        <Button
          type="submit"
          size="sm"
          variant={isActive ? "outline" : "secondary"}
          disabled={pending}
        >
          {pending ? "Saving…" : isActive ? "Pause" : "Publish"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="max-w-48 text-right text-xs text-rose-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-right text-xs text-emerald-800">
          {state.message}
        </p>
      )}
    </div>
  );
}
