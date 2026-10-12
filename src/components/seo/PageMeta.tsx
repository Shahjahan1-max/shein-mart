/**
 * PageMeta — per-page metadata override component.
 * Rendered anywhere in a page to set that page's title/meta/canonical/OG,
 * superseding the route registry defaults. Last mount wins.
 */

import { usePageMeta, type PageMeta as PageMetaType } from "../../lib/seo/meta";

export function PageMeta({ meta }: { meta: Partial<PageMetaType> }) {
  usePageMeta(meta, typeof window !== "undefined" ? window.location.pathname : "/");
  return null;
}
