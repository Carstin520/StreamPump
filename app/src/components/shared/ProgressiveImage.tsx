import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ProgressiveImageProps = ImageProps & {
  loadingEffect?: "default" | "feed";
  wrapperClassName?: string;
};

const isSignedAssetUrl = (src: ImageProps["src"]): src is string => {
  if (typeof src !== "string") {
    return false;
  }

  return /(?:X-Amz-|AWSAccessKeyId=|Signature=|Expires=)/i.test(src);
};

export const ProgressiveImage = ({
  alt,
  className,
  loadingEffect = "default",
  onError,
  onLoad,
  wrapperClassName = "",
  ...props
}: ProgressiveImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const fillWrapperClassName = props.fill ? "h-full w-full" : "";
  const isFeedEffect = loadingEffect === "feed";
  const imageClassName = `${className ?? ""} transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    isLoaded && !hasFailed
      ? "scale-100 blur-0"
      : isFeedEffect
        ? "scale-[1.01] blur-sm"
        : "scale-[1.035] blur-2xl"
  }`;
  const signedAssetSrc = isSignedAssetUrl(props.src) ? props.src : null;
  const placeholderClassName = isFeedEffect
    ? "absolute inset-0 bg-[linear-gradient(180deg,rgba(18,24,37,0.82)_0%,rgba(9,14,22,0.78)_100%)] transition-opacity duration-300"
    : "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_22%,transparent_70%),linear-gradient(180deg,rgba(18,24,37,0.96)_0%,rgba(9,14,22,0.92)_100%)] transition duration-500";

  return (
    <div className={`relative overflow-hidden ${fillWrapperClassName} ${wrapperClassName}`}>
      <div
        aria-hidden
        className={`${placeholderClassName} ${
          isLoaded ? "opacity-0" : "opacity-100"
        }`}
      />
      {signedAssetSrc ? (
        <img
          alt={alt}
          className={`${props.fill ? "absolute inset-0 h-full w-full" : ""} ${imageClassName}`}
          decoding="async"
          height={typeof props.height === "number" ? props.height : undefined}
          loading={props.priority ? "eager" : props.loading ?? "lazy"}
          onError={(event) => {
            setHasFailed(true);
            onError?.(event);
          }}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
          sizes={props.sizes}
          src={signedAssetSrc}
          style={props.style}
          width={typeof props.width === "number" ? props.width : undefined}
        />
      ) : (
        <Image
          {...props}
          alt={alt}
          className={imageClassName}
          onError={(event) => {
            setHasFailed(true);
            onError?.(event);
          }}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
        />
      )}
      {hasFailed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(18,24,37,0.96)_0%,rgba(9,14,22,0.96)_100%)] px-4 text-center text-xs text-[#9aacbf]">
          Media preview unavailable
        </div>
      ) : null}
    </div>
  );
};
