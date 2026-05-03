"use client";

import { ChatCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { getOrCreateDmThread } from "@/app/(app)/chat/actions";
import { LoadingSpinner } from "@/components/loading-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/user";

export type ChatListEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: {
    fromSelf: boolean;
    text: string | null;
    hasImage: boolean;
    stickerEmoji: string | null;
    created_at: string;
  } | null;
  unreadCount: number;
};

export function ChatList({ entries }: { entries: ChatListEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="grid h-full place-items-center px-4 text-xs text-muted-foreground">
        Нет других пользователей.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="mx-auto max-w-2xl divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.userId}>
            <ChatListRow entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatListRow({ entry }: { entry: ChatListEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await getOrCreateDmThread(entry.userId);
      if (result?.error) {
        console.error(result.error);
        return;
      }
      if (result?.thread_id) {
        router.push(`/chat/${result.thread_id}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 disabled:opacity-60 sm:px-4"
    >
      <Avatar size="default">
        {entry.avatarUrl ? (
          <AvatarImage src={entry.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback>{initials(entry.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{entry.name}</span>
          {entry.lastMessage ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatRelative(entry.lastMessage.created_at)}
            </span>
          ) : null}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {entry.lastMessage ? (
            <>
              {entry.lastMessage.fromSelf ? "Вы: " : ""}
              {entry.lastMessage.text
                ? entry.lastMessage.text
                : entry.lastMessage.stickerEmoji
                  ? `${entry.lastMessage.stickerEmoji} Стикер`
                  : entry.lastMessage.hasImage
                    ? "📷 Фото"
                    : "(пусто)"}
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <ChatCircleIcon className="size-3" /> Начать чат
            </span>
          )}
        </span>
      </div>
      {pending ? (
        <LoadingSpinner className="size-4 text-muted-foreground" />
      ) : entry.unreadCount > 0 ? (
        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {entry.unreadCount > 9 ? "9+" : entry.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(d);
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(d);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
