/** All clients (web, admin, Android) should use preferredUrl for smoothest playback. */
export function getPlaybackSrc(
  data?: { preferredUrl?: string; proxyUrl?: string; streamUrl?: string } | null
) {
  return data?.preferredUrl || data?.proxyUrl || data?.streamUrl || "";
}
