"use client";

import { BellIcon, BellSlashIcon } from "@phosphor-icons/react";
import { useEffect, useState, useTransition } from "react";

import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";

type Status =
  | "checking"
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export function PushPermission() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  function enable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setError("Уведомления не настроены на сервере.");
          return;
        }

        let reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js");
        }
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        setStatus(permission as Status);
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setError("Не удалось получить подписку.");
          return;
        }
        const result = await savePushSubscription({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        });
        if (result?.error) setError(result.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось подписаться.");
      }
    });
  }

  function disable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setStatus("default");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось отключить.");
      }
    });
  }

  if (status === "checking" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        <BellSlashIcon className="size-4 shrink-0" />
        Уведомления заблокированы в настройках браузера. Разрешите их там, чтобы
        получать пуши.
      </div>
    );
  }

  if (status === "granted") {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        <span className="inline-flex items-center gap-1.5">
          <BellIcon className="size-4 shrink-0" /> Уведомления включены
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={disable}
          disabled={pending}
        >
          Отключить
        </Button>
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-3 py-2 text-xs sm:px-4">
      <span className="inline-flex items-center gap-1.5">
        <BellIcon className="size-4 shrink-0" />
        Включите уведомления, чтобы не пропустить сообщения.
      </span>
      <div className="flex items-center gap-2">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={enable}
          disabled={pending}
        >
          {pending ? "Подключаем…" : "Включить"}
        </Button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
