// Service worker for Web Push notifications.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Новое сообщение", body: event.data.text() };
  }

  event.waitUntil(
    (async () => {
      const threadId = data.thread_id;
      if (threadId && (await hasVisibleThreadClient(threadId))) {
        await closeThreadNotifications(threadId);
        return;
      }

      const title = data.title || "Новое сообщение";
      const options = {
        body: data.body || "",
        tag: data.tag,
        renotify: false,
        icon: data.icon,
        badge: data.badge,
        data: { thread_id: threadId },
      };
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const threadId = event.notification.data && event.notification.data.thread_id;
  const path = threadId ? "/chat/" + threadId : "/chat";

  event.waitUntil(
    (async () => {
      if (threadId) await closeThreadNotifications(threadId);

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
          } catch {
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

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CHAT_THREAD_READ") return;
  event.waitUntil(closeThreadNotifications(data.threadId));
});

async function hasVisibleThreadClient(threadId) {
  const path = "/chat/" + threadId;
  const all = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  return all.some((client) => {
    const url = new URL(client.url);
    return (
      url.pathname === path &&
      (client.focused || client.visibilityState === "visible")
    );
  });
}

async function closeThreadNotifications(threadId) {
  if (!threadId) return;
  const notifications = await self.registration.getNotifications({
    includeTriggered: true,
  });
  for (const notification of notifications) {
    const data = notification.data || {};
    if (data.thread_id === threadId || notification.tag === "chat:" + threadId) {
      notification.close();
    }
  }
}

// Allow new SW to activate immediately on update.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
