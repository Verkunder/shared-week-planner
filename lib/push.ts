import "server-only";

import webpush from "web-push";

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  thread_id?: string;
  tag?: string;
  icon?: string;
};

let initialized = false;
let configured = false;

function ensureInit(): boolean {
  if (initialized) return configured;
  initialized = true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn(
      "Web Push not configured: missing NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT",
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushTo(
  subscription: StoredSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureInit()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, gone: true };
    }
    console.error("push send failed:", e);
    return { ok: false, gone: false };
  }
}
