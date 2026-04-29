"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function ChatUnreadBadge({
  count,
  currentUserId,
}: {
  count: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [localCount, setLocalCount] = useState(count);

  useEffect(() => {
    queueMicrotask(() => setLocalCount(count));
  }, [count]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function refreshUnreadCount() {
      const { data, error } = await supabase.rpc("chat_unread_count");
      if (!active || error || typeof data !== "number") return;
      setLocalCount(data);
    }

    queueMicrotask(() => void refreshUnreadCount());

    const interval = window.setInterval(() => {
      void refreshUnreadCount();
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }

    window.addEventListener("focus", refreshUnreadCount);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const channel = supabase
      .channel("chat-unread-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string };
          if (msg.sender_id !== currentUserId) {
            setLocalCount((c) => c + 1);
            void refreshUnreadCount();
            router.refresh();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_thread_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          void refreshUnreadCount();
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnreadCount);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  if (pathname.startsWith("/chat") || localCount <= 0) return null;
  return (
    <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
      {localCount > 9 ? "9+" : localCount}
    </span>
  );
}
