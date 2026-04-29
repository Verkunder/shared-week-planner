"use client";

import { ShareFatIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "ios-pwa-install-dismissed";

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

export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIosLike() || isStandalone()) return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 py-3 text-xs shadow-2xl backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:border">
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center bg-muted text-foreground">
          <ShareFatIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground">Установите планер на iPhone</p>
          <p className="text-muted-foreground">
            В Safari нажмите «Поделиться», затем «На экран Домой». После запуска
            с иконки можно включить iOS push-уведомления.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={dismiss}
          aria-label="Скрыть"
          className="shrink-0"
        >
          <XIcon className="size-3" />
        </Button>
      </div>
    </div>
  );
}
