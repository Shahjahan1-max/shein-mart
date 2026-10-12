/**
 * AppImage — foundational image component.
 * Lazy loading, explicit aspect ratio (CLS prevention), alt text, and a branded
 * fallback on load error. Normalizes API/Google-Drive URLs via imageUrl helper.
 */

import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { normalizeExternalImageUrl } from "../../lib/imageUrl";
import { cn } from "../../lib/utils";

export interface AppImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height"> {
  src?: string | null;
  alt: string;
  /** Aspect ratio as "w/h", e.g. "4/3". When provided, renders in an aspect box. */
  aspect?: string;
  width?: number | string;
  height?: number | string;
  /** Disable lazy loading (e.g. for LCP hero images). */
  eager?: boolean;
  /** Show a gradient placeholder while loading. */
  showPlaceholder?: boolean;
  className?: string;
  imgClassName?: string;
}

export function AppImage({
  src,
  alt,
  aspect,
  width,
  height,
  eager,
  showPlaceholder = true,
  className,
  imgClassName,
  style,
  ...rest
}: AppImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = normalizeExternalImageUrl(src || "");
  const showFallback = !resolvedSrc || failed;

  const wrapperStyle: CSSProperties | undefined = aspect
    ? { aspectRatio: aspect, width: width ? (typeof width === "number" ? `${width}px` : width) : "100%", ...style }
    : undefined;

  if (aspect) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-gray-100 dark:bg-gray-800",
          showPlaceholder && "animate-pulse",
          className
        )}
        style={wrapperStyle}
      >
        {showFallback ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              {initials(alt)}
            </span>
          </div>
        ) : (
          <img
            src={resolvedSrc}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed(true)}
            className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
            {...rest}
          />
        )}
      </div>
    );
  }

  return showFallback ? (
    <div className={cn("flex items-center justify-center bg-gray-100 dark:bg-gray-800", className)} style={{ width, height, ...style }}>
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{initials(alt)}</span>
    </div>
  ) : (
    <img
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      style={style}
      {...rest}
    />
  );
}

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("") || "DX";
}
