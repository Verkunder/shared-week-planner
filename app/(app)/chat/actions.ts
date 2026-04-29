"use server";

import { revalidatePath } from "next/cache";

import {
  sendPushTo,
  type PushPayload,
  type StoredSubscription,
} from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export type ChatAttachment =
  | { type: "image"; path: string; width?: number; height?: number }
  | { type: "sticker"; emoji: string };

export type ChatActionResult =
  | { error?: string; thread_id?: string }
  | undefined;

const MESSAGE_MAX_LENGTH = 4000;
const ATTACHMENTS_MAX = 4;

export async function getOrCreateDmThread(
  otherUserId: string,
): Promise<ChatActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_dm_thread", {
    other_user_id: otherUserId,
  });
  if (error) return { error: error.message };
  return { thread_id: data as string };
}

export async function sendMessage(
  threadId: string,
  text: string,
  attachments: ChatAttachment[] = [],
): Promise<ChatActionResult> {
  const trimmed = text.trim();
  if (!trimmed && attachments.length === 0) {
    return { error: "Сообщение пустое." };
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { error: "Сообщение слишком длинное." };
  }
  if (attachments.length > ATTACHMENTS_MAX) {
    return { error: "Слишком много вложений." };
  }
  for (const a of attachments) {
    if (a.type === "image") {
      if (typeof a.path !== "string" || !a.path) {
        return { error: "Некорректное вложение." };
      }
      if (!a.path.startsWith(`${threadId}/`)) {
        return { error: "Вложение из другого треда." };
      }
    } else if (a.type === "sticker") {
      if (typeof a.emoji !== "string" || !a.emoji || a.emoji.length > 16) {
        return { error: "Некорректный стикер." };
      }
    } else {
      return { error: "Некорректное вложение." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    text: trimmed || null,
    attachments,
  });
  if (error) return { error: error.message };

  void notifyRecipients(supabase, threadId, user.id, trimmed, attachments);

  revalidatePath(`/chat/${threadId}`);
  revalidatePath("/chat");
  return undefined;
}

function previewBody(text: string, attachments: ChatAttachment[]): string {
  if (text) return text;
  const sticker = attachments.find((a) => a.type === "sticker");
  if (sticker && sticker.type === "sticker") return `${sticker.emoji} Стикер`;
  if (attachments.some((a) => a.type === "image")) return "📷 Фото";
  return "Новое сообщение";
}

async function notifyRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
  senderId: string,
  text: string,
  attachments: ChatAttachment[],
): Promise<void> {
  try {
    const { data: members } = await supabase
      .from("chat_thread_members")
      .select("user_id")
      .eq("thread_id", threadId)
      .neq("user_id", senderId);
    const recipientIds = (members ?? []).map(
      (m: { user_id: string }) => m.user_id,
    );
    if (recipientIds.length === 0) return;

    const [{ data: senderProfile }, { data: subs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", senderId)
        .maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", recipientIds),
    ]);

    if (!subs || subs.length === 0) return;

    const payload: PushPayload = {
      title:
        (senderProfile as { name: string | null } | null)?.name ??
        "Новое сообщение",
      body: previewBody(text, attachments),
      thread_id: threadId,
      tag: `chat:${threadId}`,
    };

    await Promise.allSettled(
      (subs as StoredSubscription[]).map(async (sub) => {
        const result = await sendPushTo(sub, payload);
        if (result.gone) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
      }),
    );
  } catch (e) {
    console.error("notifyRecipients failed:", e);
  }
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}): Promise<ChatActionResult> {
  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { error: "Некорректная подписка." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.user_agent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };
  return undefined;
}

export async function removePushSubscription(
  endpoint: string,
): Promise<ChatActionResult> {
  if (!endpoint) return { error: "Некорректная подписка." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return undefined;
}

export async function markThreadRead(
  threadId: string,
): Promise<ChatActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { error } = await supabase
    .from("chat_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/chat");
  return undefined;
}
