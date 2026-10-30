const artworkHosts = new Set([
  "i.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
]);
export function safeArtworkUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      artworkHosts.has(url.hostname) &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443")
      ? url.href
      : null;
  } catch {
    return null;
  }
}
