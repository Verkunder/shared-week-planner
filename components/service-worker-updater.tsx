"use client";

import { useEffect } from "react";

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.update())
      .catch(() => {
        // Updating the service worker is best-effort.
      });
  }, []);

  return null;
}
