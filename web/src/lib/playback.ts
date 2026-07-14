/** Production playback: always prefer signed S3 URL (preferredUrl / streamUrl). */
export function getPlaybackSrc(
  data?: { preferredUrl?: string; proxyUrl?: string; streamUrl?: string } | null,
  _preferDirect = false
) {
  if (!data) return "";
  return data.preferredUrl || data.streamUrl || data.proxyUrl || "";
}
