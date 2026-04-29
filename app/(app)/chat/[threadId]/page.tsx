import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChatView, type ChatMessage } from "@/components/chat-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Чат",
};

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("chat_thread_members")
    .select("thread_id")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/chat");

  const { data: otherMember } = await supabase
    .from("chat_thread_members")
    .select("user_id")
    .eq("thread_id", threadId)
    .neq("user_id", user.id)
    .maybeSingle();

  let counterpart: { id: string; name: string; avatarUrl: string | null } = {
    id: "",
    name: "—",
    avatarUrl: null,
  };
  if (otherMember) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .eq("id", otherMember.user_id)
      .maybeSingle();
    if (profile) {
      counterpart = {
        id: profile.id,
        name: profile.name ?? "—",
        avatarUrl: profile.avatar_url,
      };
    }
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_id, text, created_at, attachments")
    .eq("thread_id", threadId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  return (
    <ChatView
      threadId={threadId}
      currentUserId={user.id}
      counterpart={counterpart}
      initialMessages={(messages as ChatMessage[] | null) ?? []}
    />
  );
}
