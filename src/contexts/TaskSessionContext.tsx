import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  determinePlatformFromBalance,
  shouldShiftPlatform,
  updateTaskSession,
  type Platform,
  type TaskSession,
} from "../data/taskSessionData";
import {
  archiveTaskSession,
  fetchTaskSession,
  patchTaskSession,
  upsertTaskSessionProgress,
} from "../lib/taskSessionApi";

interface TaskSessionContextValue {
  session: TaskSession | null;
  isLoading: boolean;
  error: string | null;
  initializeSession: (userId: string) => Promise<void>;
  updateSession: (updates: Partial<TaskSession>) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  shiftPlatform: (platform: Platform) => Promise<void>;
  archiveSession: () => Promise<void>;
}

export const TaskSessionContext = createContext<TaskSessionContextValue | null>(null);

export function TaskSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<TaskSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSession = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      setSession(await fetchTaskSession(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task session.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSession = useCallback(async (updates: Partial<TaskSession>) => {
    if (!session) return;
    const next = updateTaskSession(session, updates);
    setSession(next);
    try {
      await patchTaskSession(next.sessionId, next);
    } catch (err) {
      console.warn("Background patchTaskSession update:", err);
    }
  }, [session]);

  const completeTask = useCallback(async (taskId: string) => {
    if (!session || session.completedTaskIds.includes(taskId)) return;
    const completedCount = Number(session.completedTaskCount ?? session.completedCount ?? 0) + 1;
    const totalTasks = Number(session.totalTaskCount ?? session.totalTasks ?? 25);
    const next = await upsertTaskSessionProgress({
      userId: session.userId,
      taskCode: session.taskCode,
      currentPlatform: session.currentPlatform,
      completedCount,
      totalTasks,
      totalEarned: Number(session.progressState?.totalEarned || 0),
      completedTaskIds: [...session.completedTaskIds, taskId],
    });
    setSession(next);
  }, [session]);

  const shiftPlatform = useCallback(async (platform: Platform) => {
    if (!session || session.currentPlatform === platform) return;
    await updateSession({ currentPlatform: platform, highestUnlockedPlatform: platform });
  }, [session, updateSession]);

  const archiveSession = useCallback(async () => {
    if (!session) return;
    const archived = await archiveTaskSession(session.sessionId);
    setSession(null);
  }, [session]);

  useEffect(() => {
    if (user?.id) void initializeSession(user.id);
  }, [initializeSession, user?.id]);

  useEffect(() => {
    if (!user || !session) return;
    const onBalanceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ oldBalance?: number; newBalance?: number }>).detail;
      const oldBalance = Number(detail?.oldBalance ?? session.balanceState.balanceAtLastUpdate ?? user.balance ?? 0);
      const newBalance = Number(detail?.newBalance ?? user.balance ?? 0);
      if (shouldShiftPlatform(oldBalance, newBalance)) void shiftPlatform(determinePlatformFromBalance(newBalance));
      void updateSession({
        balanceState: {
          balanceAtSessionStart: session.balanceState.balanceAtSessionStart,
          balanceAtLastUpdate: newBalance,
          lastBalanceCheckAt: new Date().toISOString(),
        },
      });
    };
    window.addEventListener("ds:balance-changed", onBalanceChanged);
    return () => window.removeEventListener("ds:balance-changed", onBalanceChanged);
  }, [session, shiftPlatform, updateSession, user]);

  return (
    <TaskSessionContext.Provider value={{ session, isLoading, error, initializeSession, updateSession, completeTask, shiftPlatform, archiveSession }}>
      {children}
    </TaskSessionContext.Provider>
  );
}

export { useTaskSession } from "../hooks/useTaskSession";

