/**
 * RouteMeta — root metadata controller.
 * Mounted once inside the Router. Watches the current location and applies
 * per-route <title>, meta, canonical, OG and Twitter tags using the public
 * route registry. Auth/dashboard/admin paths are marked noindex.
 */

import { useLocation } from "wouter";
import { usePageMeta, DEFAULT_META, type PageMeta } from "../../lib/seo/meta";
import { resolveRouteMeta } from "../../lib/seo/routes";
import { isNoindexPath, normalizePath, robotsDirective } from "../../lib/seo/urls";

export function RouteMeta() {
  const [location] = useLocation();
  const path = normalizePath(location);

  const meta: Partial<PageMeta> = {
    ...DEFAULT_META,
    ...resolveRouteMeta(path),
    noindex: isNoindexPath(path),
    robots: robotsDirective(path),
  };

  usePageMeta(meta, path);
  return null;
}
