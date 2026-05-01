import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChatList, type ChatListEntry } from "@/components/chat-list";
import { PushPermission } from "@/components/push-permission";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Чат",
};

type MembershipRow = {
  thread_id: string;
  last_read_at: string;
  cleared_at: string;
};

type AttachmentRow =
  | { type: "image" }
  | { type: "sticker"; emoji: string }
  | { type: string };

type MessageRow = {
  thread_id: string;
  sender_id: string;
  text: string | null;
  created_at: string;
  deleted_at: string | null;
  attachments: AttachmentRow[] | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default async function ChatListPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, { data: ownMemberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .neq("id", user.id),
      supabase
        .from("chat_thread_members")
        .select("thread_id, last_read_at, cleared_at")
        .eq("user_id", user.id),
  ]);

  const memberships = (ownMemberships as MembershipRow[] | null) ?? [];
  const threadIds = memberships.map((m) => m.thread_id);
  const lastReadByThread = new Map<string, string>();
  const clearedByThread = new Map<string, string>();
  for (const m of memberships) lastReadByThread.set(m.thread_id, m.last_read_at);
  for (const m of memberships) clearedByThread.set(m.thread_id, m.cleared_at);

  let counterpartByThread = new Map<string, string>();
  const lastByThread = new Map<string, MessageRow>();
  const unreadByCounterpart = new Map<string, number>();

  if (threadIds.length > 0) {
    const [{ data: otherMembers }, { data: messages }] = await Promise.all([
      supabase
        .from("chat_thread_members")
        .select("thread_id, user_id")
        .in("thread_id", threadIds)
        .neq("user_id", user.id),
      supabase
        .from("chat_messages")
        .select("thread_id, sender_id, text, created_at, deleted_at, attachments")
        .in("thread_id", threadIds)
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);

    counterpartByThread = new Map(
      ((otherMembers as { thread_id: string; user_id: string }[] | null) ?? [])
        .map((m) => [m.thread_id, m.user_id]),
    );

    for (const m of (messages as MessageRow[] | null) ?? []) {
      const clearedAt = clearedByThread.get(m.thread_id) ?? "";
      if (m.created_at <= clearedAt) continue;
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
      const counterpart = counterpartByThread.get(m.thread_id);
      if (!counterpart) continue;
      const lastRead = lastReadByThread.get(m.thread_id) ?? "";
      if (m.sender_id !== user.id && m.created_at > lastRead) {
        unreadByCounterpart.set(
          counterpart,
          (unreadByCounterpart.get(counterpart) ?? 0) + 1,
        );
      }
    }
  }

  const lastByCounterpart = new Map<string, MessageRow>();
  for (const [threadId, msg] of lastByThread.entries()) {
    const counterpart = counterpartByThread.get(threadId);
    if (counterpart) lastByCounterpart.set(counterpart, msg);
  }

  const entries: ChatListEntry[] = ((profiles as ProfileRow[] | null) ?? [])
    .map((p) => {
      const last = lastByCounterpart.get(p.id);
      const hasImage =
        !!last?.attachments?.some((a) => a.type === "image");
      const stickerEmoji =
        last?.attachments?.find(
          (a): a is { type: "sticker"; emoji: string } =>
            a.type === "sticker" && "emoji" in a,
        )?.emoji ?? null;
      return {
        userId: p.id,
        name: p.name ?? "—",
        avatarUrl: p.avatar_url,
        lastMessage: last
          ? {
              fromSelf: last.sender_id === user.id,
              text: last.text,
              hasImage,
              stickerEmoji,
              created_at: last.created_at,
            }
          : null,
        unreadCount: unreadByCounterpart.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const aT = a.lastMessage?.created_at ?? "";
      const bT = b.lastMessage?.created_at ?? "";
      if (aT === bT) return a.name.localeCompare(b.name, "ru");
      return aT < bT ? 1 : -1;
    });

  return (
    <div className="flex h-full flex-col">
      <PushPermission />
      <div className="min-h-0 flex-1">
        <ChatList entries={entries} />
      </div>
    </div>
  );
}
