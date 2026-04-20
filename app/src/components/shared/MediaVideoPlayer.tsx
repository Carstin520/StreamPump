import { VideoHTMLAttributes, useEffect, useRef, useState } from "react";

import { ProgressiveImage } from "@/components/shared/ProgressiveImage";

type MediaVideoPlayerProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "className" | "poster" | "src"
> & {
  className?: string;
  loadingLabel?: string;
  posterClassName?: string;
  posterPriority?: boolean;
  posterSizes?: string;
  posterSrc?: string | null;
  src: string | null | undefined;
  videoClassName?: string;
  fallbackSrc?: string | null;
};

const isHlsSource = (value: string | null | undefined) =>
  typeof value === "string" && /\.m3u8(?:$|\?)/i.test(value);

let hlsModulePromise: Promise<typeof import("hls.js")> | null = null;

export const primeHlsJs = () => {
  if (!hlsModulePromise) {
    hlsModulePromise = import("hls.js");
  }

  return hlsModulePromise;
};

export const MediaVideoPlayer = ({
  autoPlay,
  className = "",
  controls = true,
  fallbackSrc = null,
  loadingLabel = "Loading video…",
  loop,
  muted,
  playsInline = true,
  posterClassName = "object-cover",
  posterPriority = false,
  posterSizes,
  posterSrc = null,
  preload = "metadata",
  src,
  videoClassName = "h-full w-full object-contain",
  ...videoProps
}: MediaVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setIsReady(false);
      return;
    }

    setIsReady(false);
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const markReady = () => setIsReady(true);
    const markPending = () => setIsReady(false);

    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);
    video.addEventListener("loadstart", markPending);

    if (isHlsSource(src)) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        void primeHlsJs().then(({ default: Hls }) => {
          if (cancelled) {
            return;
          }

          if (!Hls.isSupported()) {
            video.src = fallbackSrc ?? src;
            return;
          }

          const hls = new Hls({
            enableWorker: true,
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          cleanup = () => {
            hls.destroy();
          };
        });
      }
    } else {
      video.src = src;
    }

    return () => {
      cancelled = true;
      cleanup?.();
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
      video.removeEventListener("loadstart", markPending);
      video.removeAttribute("src");
      video.load();
    };
  }, [fallbackSrc, src]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {posterSrc ? (
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isReady ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <ProgressiveImage
            alt="Video poster"
            className={`h-full w-full ${posterClassName}`}
            fill
            priority={posterPriority}
            sizes={posterSizes}
            src={posterSrc}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5">
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md">
              {loadingLabel}
            </div>
          </div>
        </div>
      ) : null}

      <video
        {...videoProps}
        autoPlay={autoPlay}
        className={`transition-opacity duration-300 ${isReady ? "opacity-100" : "opacity-0"} ${videoClassName}`}
        controls={controls}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        poster={posterSrc ?? undefined}
        preload={preload}
        ref={videoRef}
      >
        {fallbackSrc ? <source src={fallbackSrc} type="video/mp4" /> : null}
      </video>

      {!posterSrc && !isReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(8,11,18,0.92)_0%,rgba(5,8,13,0.96)_100%)] px-4 text-center text-xs text-slate-300">
          {loadingLabel}
        </div>
      ) : null}
    </div>
  );
};
