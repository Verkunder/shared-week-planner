import { NextRequest } from "next/server";

export const runtime = "nodejs";

const CACHE_SECONDS = 60 * 60 * 24 * 7;
const FETCH_TIMEOUT_MS = 8000;

const ALLOWED_HOSTS = new Set([
  "image.openmoviedb.com",
  "images.openmoviedb.com",
  "st.kp.yandex.net",
  "avatars.mds.yandex.net",
]);

function isAllowedImageHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname) || hostname.endsWith(".supabase.co");
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return new Response("Missing image URL", { status: 400 });

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return new Response("Invalid image URL", { status: 400 });
  }

  if (url.protocol !== "https:" || !isAllowedImageHost(url.hostname)) {
    return new Response("Image host is not allowed", { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: CACHE_SECONDS },
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response("Image fetch failed", { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return new Response("URL is not an image", { status: 415 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
  } catch {
    return new Response("Image fetch failed", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
