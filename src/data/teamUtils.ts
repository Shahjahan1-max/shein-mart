import type { TeamData, TeamMember } from "./teamData";
import { apiUrl } from "../lib/apiClient";

export interface RegistryEntry {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  referralCode: string;
  createdAt: string;
}

export function registerInRegistry(): void {}
export function updateRegistryEntry(): void {}
export function saveUserTeam(): void {}
export function joinTeamByCode(): void {}

export function loadUserTeam(userId: string): TeamData {
  return {
    id: `team-${userId}`,
    name: "My Team",
    code: "",
    members: [],
    totalMembers: 0,
    activeMembers: 0,
    teamEarnings: 0,
    todayEarnings: 0,
    weeklyEarnings: 0,
    packageParticipation: 0,
  };
}

export async function findOwnerByCode(referralCode: string): Promise<RegistryEntry | null> {
  if (!referralCode) return null;
  try {
    const res = await fetch(apiUrl("/api/users"), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const users = await res.json() as RegistryEntry[];
    return users.find(user => user.referralCode === referralCode) ?? null;
  } catch {
    return null;
  }
}

export function propagateTeamEarnings(
  user: { id: string; referredBy?: string; referredByUserId?: string } | string | null | undefined,
  amount: number,
): void {
  if (!user || typeof user === "string" || amount <= 0) return;
  void (async () => {
    try {
      const usersRes = await fetch(apiUrl("/api/users"), { signal: AbortSignal.timeout(8000) });
      if (!usersRes.ok) return;
      const users = await usersRes.json() as Array<RegistryEntry & { earnings?: number; balance?: number; referredBy?: string }>;
      const owner = user.referredByUserId
        ? users.find(item => item.id === user.referredByUserId)
        : users.find(item => item.referralCode === user.referredBy);
      if (!owner) return;
      await fetch(apiUrl(`/api/users/${encodeURIComponent(owner.id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earnings: Number(owner.earnings || 0) + amount }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {}
  })();
}

export type { TeamMember };
