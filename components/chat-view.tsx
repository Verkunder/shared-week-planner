"use client";

import {
  ArrowLeftIcon,
  BroomIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  SmileyIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  clearThread,
  deleteAllMessages,
  deleteMessage,
  deleteThreadForEveryone,
  getThreadMessages,
  markThreadRead,
  sendMessage,
  type ChatAttachment,
} from "@/app/(app)/chat/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STICKER_PACK, twemojiUrl } from "@/lib/stickers";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/user";
import { cn } from "@/lib/utils";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ChatMessage = {
  id: string;
  sender_id: string;
  text: string | null;
  created_at: string;
  deleted_at?: string | null;
  attachments: ChatAttachment[];
};

type Counterpart = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export function ChatView({
  threadId,
  currentUserId,
  counterpart,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  counterpart: Counterpart;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useSyncedMessages(threadId, initialMessages);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const router = useRouter();

  const refreshMessages = useCallback(async () => {
    const result = await getThreadMessages(threadId);
    if (result.messages) setMessages(result.messages);
  }, [threadId, setMessages]);

  function setFilePreview(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPendingFile(file);
    const nextUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    void markThreadRead(threadId);
  }, [threadId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldMsg = payload.old as { id?: string };
            if (oldMsg.id) {
              setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
            }
            return;
          }
          const msg = payload.new as ChatMessage | undefined;
          if (!msg) return;
          if (msg.deleted_at) {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            return;
          }
          setMessages((prev) => upsertMessage(prev, msg));
          if (payload.eventType === "INSERT" && msg.sender_id !== currentUserId) {
            void markThreadRead(threadId);
          }
          void refreshMessages();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, currentUserId, setMessages, refreshMessages]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refreshMessages();
    };

    const interval = window.setInterval(refreshIfVisible, 4000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refreshMessages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) {
      setError("Поддерживаются только JPEG, PNG, WebP, GIF.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("Файл больше 10 МБ.");
      return;
    }
    setError(undefined);
    setFilePreview(f);
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    const file = pendingFile;
    if (!trimmed && !file) return;

    setText("");
    setFilePreview(null);
    setError(undefined);

    startTransition(async () => {
      const attachments: ChatAttachment[] = [];
      if (file) {
        const supabase = createClient();
        const rawExt = file.name.split(".").pop() ?? "";
        const ext = rawExt.toLowerCase().match(/^[a-z0-9]+$/)
          ? rawExt.toLowerCase()
          : mimeToExt(file.type);
        const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media")
          .upload(path, file, { contentType: file.type });
        if (upErr) {
          setError(upErr.message);
          setText(trimmed);
          setFilePreview(file);
          return;
        }
        attachments.push({ type: "image", path });
      }

      const result = await sendMessage(threadId, trimmed, attachments);
      if (result?.error) {
        setError(result.error);
        setText(trimmed);
        setFilePreview(file);
        return;
      }
      await refreshMessages();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  }

  function sendSticker(emoji: string) {
    setStickerOpen(false);
    setError(undefined);
    startTransition(async () => {
      const result = await sendMessage(threadId, "", [
        { type: "sticker", emoji },
      ]);
      if (result?.error) setError(result.error);
      else await refreshMessages();
    });
  }

  function handleClearThread() {
    if (messages.length === 0) return;
    if (!window.confirm("Очистить этот диалог только у вас?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await clearThread(threadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessages([]);
      router.refresh();
    });
  }

  function handleDeleteMessage(messageId: string) {
    if (!window.confirm("Удалить сообщение у всех?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteMessage(messageId, threadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      router.refresh();
    });
  }

  function handleDeleteAllMessages() {
    if (messages.length === 0) return;
    if (!window.confirm("Удалить все сообщения в этом диалоге у всех?")) {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await deleteAllMessages(threadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessages([]);
      router.refresh();
    });
  }

  function handleDeleteThreadForEveryone() {
    if (!window.confirm("Удалить весь диалог у всех на сервере?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteThreadForEveryone(threadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/chat");
      router.refresh();
    });
  }

  const groups = groupByDay(messages);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
        <Link
          href="/chat"
          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="К списку чатов"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <Avatar size="sm">
          {counterpart.avatarUrl ? (
            <AvatarImage src={counterpart.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback>{initials(counterpart.name)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium">{counterpart.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClearThread}
          disabled={pending || messages.length === 0}
          aria-label="Очистить диалог"
          className="ml-auto size-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <BroomIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDeleteAllMessages}
          disabled={pending || messages.length === 0}
          title="Удалить все сообщения у всех"
          aria-label="Удалить все сообщения у всех"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <TrashIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={handleDeleteThreadForEveryone}
          disabled={pending}
          title="Удалить диалог у всех"
          aria-label="Удалить диалог у всех"
          className="size-8 shrink-0"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Сообщений пока нет. Поздоровайтесь.
            </p>
          ) : null}
          {groups.map((group) => (
            <div key={group.dayKey} className="flex flex-col gap-1">
              <div className="my-1 self-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {group.dayLabel}
              </div>
              {group.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  fromSelf={m.sender_id === currentUserId}
                  onDelete={() => handleDeleteMessage(m.id)}
                  deletingDisabled={pending}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {pendingFile && previewUrl ? (
        <div className="flex shrink-0 items-start gap-2 border-t border-border bg-background px-2 py-2 sm:px-4">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="size-16 rounded-md object-cover ring-1 ring-foreground/10"
            />
            <button
              type="button"
              onClick={() => setFilePreview(null)}
              disabled={pending}
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background shadow-md hover:bg-foreground/80"
              aria-label="Убрать фото"
            >
              <XIcon className="size-3" />
            </button>
          </div>
          <span className="self-center text-xs text-muted-foreground">
            {pendingFile.name}
          </span>
        </div>
      ) : null}

      {stickerOpen ? (
        <StickerPanel onPick={sendSticker} disabled={pending} />
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-2 py-2 sm:px-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          onChange={handleFilePick}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Прикрепить фото"
          className="size-9 shrink-0"
        >
          <PaperclipIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={() => setStickerOpen((s) => !s)}
          aria-label="Стикеры"
          aria-pressed={stickerOpen}
          className="size-9 shrink-0"
        >
          <SmileyIcon />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение…"
          rows={1}
          className="max-h-32 min-h-9 resize-none"
          disabled={pending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || (!text.trim() && !pendingFile)}
          aria-label="Отправить"
          className="size-9 shrink-0"
        >
          <PaperPlaneTiltIcon />
        </Button>
      </form>

      {error ? (
        <p
          role="alert"
          className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-1 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function useSyncedMessages(threadId: string, initialMessages: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setMessages(initialMessages);
    });
    return () => {
      active = false;
    };
  }, [threadId, initialMessages]);

  return [messages, setMessages] as const;
}

function MessageBubble({
  message,
  fromSelf,
  onDelete,
  deletingDisabled,
}: {
  message: ChatMessage;
  fromSelf: boolean;
  onDelete?: () => void;
  deletingDisabled: boolean;
}) {
  const attachments = message.attachments ?? [];
  const images = attachments.filter((a) => a.type === "image");
  const stickers = attachments.filter((a) => a.type === "sticker");
  const hasText = message.text && message.text.length > 0;

  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        fromSelf ? "self-end items-end" : "self-start items-start",
      )}
    >
      {stickers.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${s.emoji}-${i}`}
          src={twemojiUrl(s.emoji, 72)}
          alt={s.emoji}
          className="size-24 select-none"
          draggable={false}
        />
      ))}
      {images.length > 0 ? (
        <div
          className={cn(
            "grid gap-1",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {images.map((a) => (
            <ImageAttachment key={a.path} path={a.path} />
          ))}
        </div>
      ) : null}
      {hasText ? (
        <div
          className={cn(
            "whitespace-pre-wrap wrap-break-word rounded-2xl px-3 py-1.5 text-sm",
            fromSelf
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
          )}
        >
          {message.text}
        </div>
      ) : null}
      <span className="text-[10px] text-muted-foreground">
        {formatTime(message.created_at)}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deletingDisabled}
            className="ml-2 align-middle text-muted-foreground hover:text-destructive disabled:opacity-50"
            aria-label="Удалить сообщение"
          >
            <TrashIcon className="inline size-3" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function StickerPanel({
  onPick,
  disabled,
}: {
  onPick: (emoji: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="shrink-0 max-h-56 overflow-y-auto border-t border-border bg-background px-2 py-2 sm:px-4">
      <div className="mx-auto grid max-w-2xl grid-cols-7 gap-1 sm:grid-cols-10">
        {STICKER_PACK.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            disabled={disabled}
            aria-label={emoji}
            className="grid place-items-center rounded-md p-1 transition-colors hover:bg-muted disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={twemojiUrl(emoji, 72)}
              alt={emoji}
              className="size-8 select-none"
              draggable={false}
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageAttachment({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.storage
      .from("chat-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("signed url failed:", error);
          return;
        }
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="aspect-video w-48 animate-pulse rounded-lg bg-muted" />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="max-h-72 max-w-full rounded-lg object-cover"
        loading="lazy"
      />
    </a>
  );
}

function upsertMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const next = messages.some((m) => m.id === message.id)
    ? messages.map((m) => (m.id === message.id ? message : m))
    : [...messages, message];

  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function mimeToExt(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

type DayGroup = {
  dayKey: string;
  dayLabel: string;
  messages: ChatMessage[];
};

function groupByDay(messages: ChatMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of messages) {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.messages.push(m);
    } else {
      groups.push({ dayKey: key, dayLabel: formatDay(d), messages: [m] });
    }
  }
  return groups;
}

function formatDay(d: Date): string {
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Сегодня";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Вчера";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(d);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
