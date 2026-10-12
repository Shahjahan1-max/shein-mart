import { useContext } from "react";
import { TaskSessionContext } from "../contexts/TaskSessionContext";

export function useTaskSession() {
  const ctx = useContext(TaskSessionContext);
  if (!ctx) throw new Error("useTaskSession must be used within TaskSessionProvider");
  return ctx;
}
