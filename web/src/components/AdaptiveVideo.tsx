import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import { isHlsUrl } from "@/lib/playback";

type Props = {
  src: string;
  className?: string;
  onTimeUpdate?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onCanPlay?: () => void;
  onError?: () => void;
  onLoadedMetadata?: () => void;
};

/**
 * HTML5 video with HLS.js adaptive bitrate (YouTube-style) when src is .m3u8.
 * Safari uses native HLS. Progressive MP4 uses plain src.
 */
const AdaptiveVideo = forwardRef<HTMLVideoElement, Props>(function AdaptiveVideo(
  {
    src,
    className,
    onTimeUpdate,
    onPause,
    onEnded,
    onWaiting,
    onPlaying,
    onCanPlay,
    onError,
    onLoadedMetadata,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    let cancelled = false;

    const fail = () => {
      if (!cancelled) onError?.();
    };

    if (isHlsUrl(src)) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // auto
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) fail();
        });
      } else {
        fail();
      }
    } else {
      video.src = src;
    }

    return () => {
      cancelled = true;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      controlsList="nodownload"
      playsInline
      preload="auto"
      onTimeUpdate={onTimeUpdate}
      onPause={onPause}
      onEnded={onEnded}
      onWaiting={onWaiting}
      onPlaying={onPlaying}
      onCanPlay={onCanPlay}
      onError={onError}
      onLoadedMetadata={onLoadedMetadata}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
});

export default AdaptiveVideo;
