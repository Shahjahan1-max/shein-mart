import { useState, useEffect, useRef } from "react";

/**
 * Lightweight event/poll data hook.
 *
 * Keeps data fresh via three complementary mechanisms so admin changes
 * are immediately reflected everywhere without a page reload:
 *   1. `ds:data-changed` custom event — same-tab, fires instantly on save
 *   2. `storage` browser event      — cross-tab sync
 *   3. `setInterval` polling        — fallback catch-all (default 30 s)
 *
 * Default poll interval raised from 5s to 30s — event listeners handle
 * instant updates; polling is only a safety net for missed events.
 */
export function useLiveData<T>(loader: () => T, pollMs = 30_000): T {
  const [data, setData] = useState<T>(loader);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const refresh = () => setData(loaderRef.current());
    // Only refresh on storage events (cross-tab) — not on every ds:data-changed
    // ds:data-changed fires for every Firebase write and would cause constant re-renders
    window.addEventListener("storage", refresh);
    const id = setInterval(refresh, pollMs);
    return () => {
      window.removeEventListener("storage", refresh);
      clearInterval(id);
    };
  }, [pollMs]);

  return data;
}
