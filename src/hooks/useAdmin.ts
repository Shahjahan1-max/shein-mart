import { useContext } from "react";
import { AdminContext } from "../contexts/AdminContext";

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be inside AdminProvider");
  return ctx;
}
