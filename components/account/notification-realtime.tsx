"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useToast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface NotificationRow {
  title: string;
  body: string;
}

export function NotificationRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = client
      .channel(`user-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!active) return;
          const notification = payload.new as NotificationRow;
          if (notification.title) {
            toast({
              title: notification.title,
              description: notification.body,
            });
          }
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [router, toast, userId]);

  return null;
}
