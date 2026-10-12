import { apiUrl } from "./apiClient";

const API_BASE = "/api/users";
const TIMEOUT_MS = 5000;

export interface RegistrySyncEntry {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  referralCode: string;
  createdAt: string;
}

export async function pushUserToServer(user: RegistrySyncEntry): Promise<void> {
  await fetch(apiUrl(API_BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {});
}

export async function pullUsersFromServer(): Promise<RegistrySyncEntry[]> {
  try {
    const res = await fetch(apiUrl(API_BASE), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const users = await res.json();
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

export async function pushLocalRegistryToServer(): Promise<void> {}
