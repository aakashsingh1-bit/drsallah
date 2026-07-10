/** Prefer API proxy; fall back to direct S3 if proxy fails in the player. */
export function getPlaybackSrc(
  data?: { preferredUrl?: string; proxyUrl?: string; streamUrl?: string } | null,
  preferDirect = false
) {
  if (!data) return "";
  if (preferDirect) {
    return data.streamUrl || data.preferredUrl || data.proxyUrl || "";
  }
  return data.preferredUrl || data.proxyUrl || data.streamUrl || "";
}
