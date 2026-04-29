// Service worker for Web Push notifications.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch (_e) {
    data = { title: "Новое сообщение", body: event.data.text() };
  }
  const title = data.title || "Новое сообщение";
  const options = {
    body: data.body || "",
    tag: data.tag,
    icon: data.icon,
    badge: data.badge,
    data: { thread_id: data.thread_id },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const threadId = event.notification.data && event.notification.data.thread_id;
  const path = threadId ? "/chat/" + threadId : "/chat";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        const url = new URL(client.url);
        if (url.pathname === path && "focus" in client) {
          await client.focus();
          return;
        }
      }
      if (all.length > 0) {
        const client = all[0];
        if ("focus" in client) await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(path);
          } catch (_e) {
            // navigate is restricted in some browsers; fall back to openWindow
            if (self.clients.openWindow) {
              await self.clients.openWindow(path);
            }
          }
        }
        return;
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(path);
      }
    })(),
  );
});

// Allow new SW to activate immediately on update.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
