import { api } from "./apiClient";
import {
  createTaskSession,
  mergeTaskSessions,
  updateTaskSession,
  type Platform,
  type TaskSession,
  type TaskStatus,
} from "../data/taskSessionData";

type ApiResponse<T> = { success?: boolean; data?: T };

export async function fetchTaskSession(userId: string): Promise<TaskSession | null> {
  try {
    const res = await api.get<ApiResponse<TaskSession>>(`/api/task-sessions/${encodeURIComponent(userId)}`);
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchAllTaskSessions(userId?: string): Promise<TaskSession[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await api.get<ApiResponse<TaskSession[]>>(`/api/task-sessions${qs}`);
  return res.data ?? [];
}

export async function saveTaskSession(session: TaskSession): Promise<TaskSession> {
  const existing = await fetchTaskSession(session.userId);
  const body = existing?.sessionId === session.sessionId ? session : session;
  const res = await api.post<ApiResponse<TaskSession>>("/api/task-sessions", body);
  return res.data ?? session;
}

export async function patchTaskSession(sessionId: string, patch: Partial<TaskSession>): Promise<TaskSession | null> {
  const res = await api.put<ApiResponse<TaskSession>>(`/api/task-sessions/${encodeURIComponent(sessionId)}`, patch);
  return res.data ?? null;
}

export async function archiveTaskSession(sessionId: string): Promise<TaskSession | null> {
  const res = await api.post<ApiResponse<TaskSession>>(`/api/task-sessions/${encodeURIComponent(sessionId)}/archive`, {});
  return res.data ?? null;
}

export async function deleteTaskSession(sessionId: string): Promise<void> {
  await api.delete(`/api/task-sessions/${encodeURIComponent(sessionId)}`);
}

export function resolveTaskSessionConflict(local: TaskSession, remote: TaskSession): TaskSession {
  return String(remote.updatedAt).localeCompare(String(local.updatedAt)) >= 0 ? remote : local;
}

export async function upsertTaskSessionProgress(input: {
  userId: string;
  taskCode: string | number;
  currentPlatform?: Platform;
  currentBalance?: number;
  completedCount: number;
  totalTasks?: number;
  totalEarned?: number;
  completedTaskIds?: string[];
  taskStatus?: TaskStatus;
}): Promise<TaskSession> {
  const taskCode = String(input.taskCode);
  const totalTasks = Math.max(1, Number(input.totalTasks || 25));
  const completedCount = Math.min(Math.max(0, Number(input.completedCount || 0)), totalTasks);
  const existing = await fetchTaskSession(input.userId);
  const base = createTaskSession({
    userId: input.userId,
    taskCode,
    currentPlatform: input.currentPlatform,
    totalTasks,
    currentBalance: input.currentBalance,
    sessionId: existing?.sessionId || `ts_${input.userId}_${taskCode}`,
  });
  if (!existing || existing.taskCode !== taskCode) return base;
  const session = updateTaskSession(existing, {
    currentTaskIndex: completedCount,
    completedCount,
    completedTaskCount: completedCount,
    completedTaskIds: input.completedTaskIds ?? base.completedTaskIds,
    taskStatus: completedCount >= totalTasks ? "completed" : (input.taskStatus ?? "in_progress"),
    status: completedCount >= totalTasks ? "completed" : (input.taskStatus ?? "in_progress"),
    progressState: {
      totalEarned: Number(input.totalEarned || 0),
      lastTaskCompletedAt: completedCount > 0 ? new Date().toISOString() : undefined,
    },
    completedAt: completedCount >= totalTasks ? new Date().toISOString() : undefined,
  });
  const res = await api.put<ApiResponse<TaskSession>>(`/api/task-sessions/${encodeURIComponent(existing.sessionId)}`, session);
  return res.data ?? session;
}

export { mergeTaskSessions };
