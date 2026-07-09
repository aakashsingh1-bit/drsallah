/** Web browsers use API proxy (smoother chunks). Android uses direct streamUrl. */
export function getPlaybackSrc(data?: { proxyUrl?: string; streamUrl?: string } | null) {
  return data?.proxyUrl || data?.streamUrl || "";
}
