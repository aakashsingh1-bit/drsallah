/** Prefer HLS adaptive when ready; else optimized progressive S3 URL. */
export function getPlaybackSrc(
  data?: {
    hlsUrl?: string;
    preferredUrl?: string;
    proxyUrl?: string;
    streamUrl?: string;
  } | null,
  preferProgressive = false
) {
  if (!data) return "";
  if (preferProgressive) {
    return data.streamUrl || data.preferredUrl || data.proxyUrl || "";
  }
  return data.hlsUrl || data.preferredUrl || data.streamUrl || data.proxyUrl || "";
}

export function isHlsUrl(src?: string | null) {
  if (!src) return false;
  return /\.m3u8(\?|$)/i.test(src) || src.includes("/hls/");
}
