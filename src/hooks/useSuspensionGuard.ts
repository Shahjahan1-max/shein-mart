import { useAuth } from "../contexts/AuthContext";
import { useUser } from "./useApi";

export function useSuspensionGuard(): boolean {
  const { user } = useAuth();
  const { data: latest } = useUser(user?.id);
  if (!user) return false;
  return (latest?.status ?? user.status) === "suspended";
}
