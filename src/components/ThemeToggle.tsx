import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useSettings } from "../hooks/useApi";

export type ThemeChoice = "light" | "dark";
type ResolvedTheme = "light" | "dark";
export type PanelType = "admin" | "user" | "public";

interface ThemeContextValue {
  themeChoice: ThemeChoice;
  theme: ResolvedTheme;
  toggle: () => void;
  setTheme: (choice: ThemeChoice) => void;
  panelType: PanelType;
  setPanelType: (panel: PanelType, adminDefault?: ThemeChoice, userDefault?: ThemeChoice) => void;
}

const PANEL_KEYS: Record<PanelType, string> = {
  admin:  "ds-theme-admin",
  user:   "ds-theme-user",
  public: "ds-theme",
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function getPanelDefault(_panel: PanelType, _settings?: Partial<typeof DEFAULT_SETTINGS> | null): ThemeChoice {
  return "light";
}

function loadSavedPanelChoice(panel: PanelType): ThemeChoice | null {
  const key = PANEL_KEYS[panel];
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;

    if (panel === "user") {
      const legacy = localStorage.getItem("ds-theme");
      if (legacy === "light" || legacy === "dark") {
        try { localStorage.setItem(key, legacy); } catch {}
        return legacy;
      }
    }
  } catch {}
  return null;
}

function loadPanelChoice(panel: PanelType): ThemeChoice {
  const saved = loadSavedPanelChoice(panel);
  if (saved) return saved;
  return getPanelDefault(panel);
}

function detectPanelFromUrl(): PanelType {
  try {
    const path = window.location.pathname;
    if (path.startsWith("/admin") || path.startsWith("/super-admin")) return "admin";
  } catch {}
  return "user";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: apiSettings, loading: settingsLoading } = useSettings<Partial<typeof DEFAULT_SETTINGS>>();
  const initialPanel = detectPanelFromUrl();
  const initialSavedChoice = loadSavedPanelChoice(initialPanel);
  const [panelType, setPanelTypeState] = useState<PanelType>(() => initialPanel);
  const [choice, setChoiceState]       = useState<ThemeChoice>(() => initialSavedChoice ?? "light");
  const [hasSavedChoice, setHasSavedChoice] = useState(() => Boolean(initialSavedChoice));
  const choiceRef = useRef(choice);
  const panelRef  = useRef(panelType);
  choiceRef.current = choice;
  panelRef.current  = panelType;
  const settingsReady = !settingsLoading;
  const effectiveChoice: ThemeChoice = hasSavedChoice ? choice : getPanelDefault(panelType, settingsReady ? apiSettings : null);
  const resolved: ResolvedTheme = effectiveChoice === "dark" ? "dark" : "light";
  const waitingForPublishedSettings = settingsLoading && !hasSavedChoice;

  useLayoutEffect(() => {
    if (waitingForPublishedSettings) return;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    if (hasSavedChoice) {
      try { localStorage.setItem(PANEL_KEYS[panelType], effectiveChoice); } catch {}
    }
  }, [effectiveChoice, hasSavedChoice, panelType, resolved, waitingForPublishedSettings]);

  const setPanelType = useCallback((panel: PanelType, adminDefault?: ThemeChoice, userDefault?: ThemeChoice) => {
    const overrides: Partial<Record<PanelType, ThemeChoice>> = {};
    if (adminDefault) overrides.admin = adminDefault;
    if (userDefault)  overrides.user  = userDefault;

    const savedChoice = loadSavedPanelChoice(panel);
    const fallback: ThemeChoice = overrides[panel] ?? getPanelDefault(panel, apiSettings);
    const eff = savedChoice ?? fallback;
    setPanelTypeState(prev => (prev === panel ? prev : panel));
    setChoiceState(prev => (prev === eff ? prev : eff));
    setHasSavedChoice(Boolean(savedChoice));
  }, [apiSettings]);

  const setTheme = useCallback((c: ThemeChoice) => {
    const nextChoice: ThemeChoice = c === "dark" ? "dark" : "light";
    setHasSavedChoice(true);
    setChoiceState(nextChoice);
  }, []);

  const toggle = useCallback(() => {
    setHasSavedChoice(true);
    setChoiceState(c => (c === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ themeChoice: effectiveChoice, theme: resolved, toggle, setTheme, panelType, setPanelType }),
    [effectiveChoice, panelType, resolved, setPanelType, setTheme, toggle],
  );

  if (waitingForPublishedSettings) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, border: "2px solid #254C73", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export { useTheme } from "../hooks/useTheme";

export function ThemeToggle({ theme: propTheme, toggle: propToggle, className = "" }: { theme?: ResolvedTheme; toggle?: () => void; className?: string }) {
  const themeCtx = useContext(ThemeContext);
  const theme = propTheme ?? themeCtx?.theme ?? "light";
  const toggle = propToggle ?? themeCtx?.toggle ?? (() => {});

  const isDark = theme === "dark";
  const label = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      type="button"
      className={`p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none flex items-center justify-center ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 dark:text-gray-300 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
