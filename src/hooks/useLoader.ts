import { useContext } from "react";
import { LoaderContext } from "../contexts/LoaderContext";

export function useLoader() {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("useLoader must be inside LoaderProvider");
  return ctx;
}
