export type NextTaskReqStatus = "pending" | "approved" | "rejected";

export interface NextTaskRequest {
  id: string;
  userId: string;
  userName: string;
  completedCode: number;
  requestedAt: string;
  status: NextTaskReqStatus;
  assignedCode?: number;
  adminNote?: string;
  respondedAt?: string;
}

export function loadNextTaskRequests(): NextTaskRequest[] {
  return [];
}

export function saveNextTaskRequests(reqs: NextTaskRequest[]): void {
  void reqs;
}

export function getUserLatestRequest(userId: string, completedCode: number): NextTaskRequest | null {
  const all = loadNextTaskRequests();
  const matches = all.filter(r => r.userId === userId && r.completedCode === completedCode);
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

export function createNextTaskRequest(userId: string, userName: string, completedCode: number): NextTaskRequest {
  const req: NextTaskRequest = {
    id: `ntr-${Date.now()}`,
    userId,
    userName,
    completedCode,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  const all = loadNextTaskRequests();
  all.push(req);
  saveNextTaskRequests(all);
  return req;
}

export function updateNextTaskRequest(id: string, updates: Partial<Omit<NextTaskRequest, "id">>): void {
  const all = loadNextTaskRequests().map(r => r.id === id ? { ...r, ...updates } : r);
  saveNextTaskRequests(all);
}

export function countPendingNextTaskRequests(): number {
  return loadNextTaskRequests().filter(r => r.status === "pending").length;
}

export function hasAlreadyCompletedCode(userId: string, code: number): boolean {
  return loadNextTaskRequests().some(
    r => r.userId === userId && r.assignedCode === code && r.status === "approved"
  );
}
