/** Prefer direct S3 (fast). Proxy only as fallback. */
export function getPlaybackSrc(
  data?: { preferredUrl?: string; proxyUrl?: string; streamUrl?: string } | null,
  preferDirect = false
) {
  if (!data) return "";
  // preferDirect or default: streamUrl first for instant play
  if (preferDirect) {
    return data.streamUrl || data.preferredUrl || data.proxyUrl || "";
  }
  return data.preferredUrl || data.streamUrl || data.proxyUrl || "";
}
