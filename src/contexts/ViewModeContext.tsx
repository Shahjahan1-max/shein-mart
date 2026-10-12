import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSettings } from "../hooks/useApi";
import type { PlatformSettings } from "../data/adminData";

export type ViewMode = "mobile" | "desktop";

interface ViewModeContextValue {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

const STORAGE_KEY = "ds_view_mode";
const MANUAL_STORAGE_KEY = "ds_view_mode_manual";

/** Detect actual device type by screen width (breakpoint: 768 px = Tailwind "md") */
function detectDeviceMode(): ViewMode {
  try {
    return window.innerWidth >= 768 ? "desktop" : "mobile";
  } catch {
    return "mobile";
  }
}

export const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings<PlatformSettings>();
  const defaultMode = settings?.defaultViewMode;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
      if (saved === "mobile" || saved === "desktop") return saved;
    } catch {}
    if (defaultMode === "mobile" || defaultMode === "desktop") return defaultMode;
    /* No saved preference → default to actual device type */
    return detectDeviceMode();
  });

  useEffect(() => {
    const defaultViewMode = settings?.defaultViewMode;
    if (defaultViewMode !== "mobile" && defaultViewMode !== "desktop") return;
    try {
      if (localStorage.getItem(MANUAL_STORAGE_KEY) === "true") return;
    } catch {}
    setViewMode(defaultViewMode);
  }, [settings?.defaultViewMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
    document.documentElement.setAttribute("data-view", viewMode);
  }, [viewMode]);

  const toggleViewMode = () => {
    try { localStorage.setItem(MANUAL_STORAGE_KEY, "true"); } catch {}
    setViewMode(m => (m === "mobile" ? "desktop" : "mobile"));
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export { useViewMode } from "../hooks/useViewMode";

