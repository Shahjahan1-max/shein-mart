import { api, listFirebaseDocs } from "../lib/apiClient";

export type ResetStatus = "pending" | "sent" | "used" | "expired" | "revoked";
export type ResetCreatedBy = "user" | "admin";
export type ResetAction =
  | "REQUEST_CREATED"
  | "RESET_LINK_SENT"
  | "RESET_LINK_USED"
  | "RESET_LINK_EXPIRED"
  | "RESET_LINK_REVOKED";

export interface PasswordResetRequest {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  status: ResetStatus;
  createdBy: ResetCreatedBy;
  requestedByAdminId: string | null;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  lastSentAt: string | null;
}

export interface PasswordResetLog {
  id: string;
  userId: string;
  adminId: string | null;
  action: ResetAction;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function loadResetRequests(): Promise<PasswordResetRequest[]> {
  return listFirebaseDocs<PasswordResetRequest>("passwordResetRequests");
}

export async function loadResetLogs(): Promise<PasswordResetLog[]> {
  return listFirebaseDocs<PasswordResetLog>("passwordResetLogs");
}

export async function createResetRequest(
  userId: string,
  email: string,
  createdBy: ResetCreatedBy,
  adminId: string | null = null,
): Promise<{ request: PasswordResetRequest; rawToken: string }> {
  void userId;
  const res = await api.post<{ success: boolean; data: PasswordResetRequest | null; rawToken?: string }>(
    "/api/password-reset/request",
    { email, createdBy, adminId },
    createdBy === "admin" ? { requiresAdmin: true } : undefined,
  );
  if (!res.data || !res.rawToken) throw new Error("No reset request was created.");
  return { request: res.data, rawToken: res.rawToken };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post<{ success: boolean; data: null }>(
    "/api/password-reset/request",
    { email, createdBy: "user" },
  );
}

export async function verifyResetToken(rawToken: string): Promise<PasswordResetRequest | null> {
  const res = await api.post<{ success: boolean; data: PasswordResetRequest | null }>(
    "/api/password-reset/verify",
    { token: rawToken },
  );
  return res.data ?? null;
}

export async function consumeResetToken(rawToken: string, newPassword: string): Promise<boolean> {
  try {
    await api.post<{ success: boolean }>("/api/password-reset/consume", { token: rawToken, newPassword });
    return true;
  } catch {
    return false;
  }
}

export async function revokeResetRequest(requestId: string, adminId: string): Promise<void> {
  void adminId;
  await api.delete(`/api/password-reset/requests/${encodeURIComponent(requestId)}`, { requiresAdmin: true });
}

export async function expireStaleRequests(): Promise<void> {}

export async function lookupUserByEmail(email: string): Promise<{ userId: string; email: string } | null> {
  const users = await api.get<Array<{ id: string; email?: string }>>("/api/users");
  const user = users.find(item => String(item.email || "").toLowerCase() === email.toLowerCase().trim());
  return user?.email ? { userId: user.id, email: user.email } : null;
}

export async function getAllUsersForAdmin(): Promise<Array<{ id: string; name: string; email: string }>> {
  const users = await api.get<Array<{ id: string; name: string; email?: string }>>("/api/users");
  return users.filter(user => user.email).map(user => ({ id: user.id, name: user.name, email: user.email || "" }));
}

export async function getLatestRequestForUser(userId: string): Promise<PasswordResetRequest | null> {
  const requests = await loadResetRequests();
  return requests.find(r => r.userId === userId) ?? null;
}

export function getUserNameById(userId: string): string {
  return userId;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function buildResetUrl(rawToken: string): string {
  return `${window.location.origin}/reset-password?token=${rawToken}`;
}
