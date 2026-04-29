"use client";

import { BellIcon, BellSlashIcon, ShareFatIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";

type Status =
  | "checking"
  | "unsupported"
  | "ios-install-required"
  | "default"
  | "granted"
  | "denied";

export function PushPermission() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const syncSubscription = useCallback(
    async (requestPermission: boolean): Promise<Status | undefined> => {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Уведомления не настроены на сервере.");
        return undefined;
      }

      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      const permission = requestPermission
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") return permission as Status;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("Не удалось получить подписку.");
        return permission as Status;
      }

      const result = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      });
      if (result?.error) setError(result.error);
      return permission as Status;
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isIosLike() && !isStandalone()) {
      queueMicrotask(() => setStatus("ios-install-required"));
      return;
    }
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    const nextStatus = supported
      ? (Notification.permission as Status)
      : "unsupported";
    queueMicrotask(() => setStatus(nextStatus));
  }, []);

  useEffect(() => {
    if (status !== "granted") return;
    queueMicrotask(() => void syncSubscription(false));
  }, [status, syncSubscription]);

  function enable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const permission = await syncSubscription(true);
        if (permission) setStatus(permission);
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

  if (status === "ios-install-required") {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        <ShareFatIcon className="size-4 shrink-0 text-foreground" />
        <span>
          На iPhone пуши включаются только в приложении с экрана Домой:
          откройте Safari, нажмите «Поделиться», затем «На экран Домой».
        </span>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        <BellSlashIcon className="size-4 shrink-0" />
        Уведомления заблокированы в настройках браузера. Разрешите их там,
        чтобы получать пуши.
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
        {error ? <span className="text-destructive">{error}</span> : null}
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
        {error ? <span className="text-destructive">{error}</span> : null}
        <Button type="button" size="sm" onClick={enable} disabled={pending}>
          {pending ? "Подключаем..." : "Включить"}
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

function isIosLike(): boolean {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadDesktopMode =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;
  return iOSDevice || iPadDesktopMode;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}
