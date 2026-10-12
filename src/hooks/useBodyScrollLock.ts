import { useEffect } from "react";

/**
 * Locks document.body scroll while `active` is true.
 * Restores the original overflow on cleanup or when `active` turns false.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}
