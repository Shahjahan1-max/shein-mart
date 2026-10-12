import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { AtomSize } from "../components/Atom";
import { DEFAULT_SETTINGS } from "../data/adminData";
import { useSettings } from "../hooks/useApi";

export interface LoaderSettings {
  enabled:   boolean;
  color:     string;
  size:      AtomSize;
  text:      string;
  textColor: string;
}

const DEFAULT_LOADER_SETTINGS: LoaderSettings = {
  enabled:   true,
  color:     "#2cd136",
  size:      "medium",
  text:      "Earn & Invest be a Enterprenuer",
  textColor: "",
};

function toLoaderSettings(parsed: Partial<typeof DEFAULT_SETTINGS> | null | undefined): LoaderSettings {
  return {
    enabled:   parsed?.loaderEnabled   ?? DEFAULT_LOADER_SETTINGS.enabled,
    color:     parsed?.loaderColor     ?? DEFAULT_LOADER_SETTINGS.color,
    size:      (parsed?.loaderSize as AtomSize) ?? DEFAULT_LOADER_SETTINGS.size,
    text:      parsed?.loaderText      ?? DEFAULT_LOADER_SETTINGS.text,
    textColor: parsed?.loaderTextColor ?? DEFAULT_LOADER_SETTINGS.textColor,
  };
}

interface LoaderContextValue {
  isLoading: boolean;
  show:      () => void;
  hide:      () => void;
  settings:  LoaderSettings;
}

export const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: apiSettings } = useSettings<Partial<typeof DEFAULT_SETTINGS>>();
  const settings = toLoaderSettings(apiSettings);

  const show = useCallback(() => setIsLoading(true),  []);
  const hide = useCallback(() => setIsLoading(false), []);

  return (
    <LoaderContext.Provider value={{ isLoading, show, hide, settings }}>
      {children}
    </LoaderContext.Provider>
  );
}

export { useLoader } from "../hooks/useLoader";

