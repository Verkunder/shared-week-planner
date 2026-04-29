const IMAGE_PROXY_PATH = "/api/image-proxy";

export function proxiedImageSrc(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (
    src.startsWith("/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  ) {
    return src;
  }

  try {
    const url = new URL(src);
    if (url.protocol !== "http:" && url.protocol !== "https:") return src;
    return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return src;
  }
}
