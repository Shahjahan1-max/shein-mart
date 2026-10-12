import { useEffect } from "react";
import { useSettings } from "./useApi";

const FALLBACK_FAVICON = "/favicon.png";

function applyFavicon(dataUrl: string | undefined): void {
  try {
    const href = dataUrl && dataUrl.length > 0
      ? dataUrl
      : `${FALLBACK_FAVICON}?v=${Date.now()}`;

    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];
    let updated = false;
    for (const sel of selectors) {
      const el = document.querySelector<HTMLLinkElement>(sel);
      if (el) {
        el.href = href;
        updated = true;
      }
    }
    if (!updated) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = dataUrl ? "image/png" : "image/svg+xml";
      link.href = href;
      document.head.appendChild(link);
    }
  } catch {}
}

export function useFavicon(): void {
  const { data } = useSettings<{ siteFavicon?: string }>();

  useEffect(() => {
    applyFavicon(data?.siteFavicon);
  }, [data?.siteFavicon]);
}
