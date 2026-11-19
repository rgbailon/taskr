import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { Task } from "../domain/models";
import { notifyDesktop } from "../domain/repository";
import { useFocusTimer, type TimerStatus } from "../hooks/useFocusTimer";
import { useWorkspace } from "./WorkspaceProvider";
import { useToast } from "./ToastProvider";

interface FocusSession {
  id: string;
  title: string;
}

interface FocusTimerValue {
  status: TimerStatus;
  remaining: number;
  totalSeconds: number;
  progress: number;
  isRunning: boolean;
  sessionTaskId: string | null;
  startForTask: (task: Task) => void;
  toggleForTask: (task: Task) => void;
  reset: () => void;
}

const FocusTimerContext = createContext<FocusTimerValue | null>(null);

/**
 * Owns the single focus timer for the whole app so a running session survives
 * navigation between views. The session stays bound to the task it started on.
 */
export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const sessionRef = useRef<FocusSession | null>(null);

  const durationMinutes = workspace?.preferences.focusMinutes ?? 25;
  const breakMinutes = workspace?.preferences.breakMinutes ?? 5;

  const timer = useFocusTimer({
    durationMinutes,
    onComplete: (minutes) => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (!session) return;
      const title = workspace?.taskById(session.id)?.title ?? session.title;
      update((current) => current.logFocusSession(session.id, minutes));
      notifyDesktop("Focus session complete", `${title} · ${minutes} min`);
      pushToast({
        title: "Focus session complete",
        detail: `${title} · take a ${breakMinutes}-minute break.`,
        tone: "success",
        durationMs: 8000,
      });
    },
  });

  const startForTask = useCallback(
    (task: Task) => {
      const sameSession = sessionRef.current?.id === task.id;
      if (timer.status === "running" && sameSession) return;
      if (timer.status !== "idle" && !(timer.status === "paused" && sameSession)) {
        timer.reset();
      }
      sessionRef.current = { id: task.id, title: task.title };
      timer.start();
    },
    [timer],
  );

  const toggleForTask = useCallback(
    (task: Task) => {
      if (timer.status === "running") {
        timer.pause();
        return;
      }
      if (timer.status === "paused" && sessionRef.current?.id === task.id) {
        timer.start();
        return;
      }
      if (timer.status === "paused") {
        timer.reset();
      }
      sessionRef.current = { id: task.id, title: task.title };
      timer.start();
    },
    [timer],
  );

  const reset = useCallback(() => {
    sessionRef.current = null;
    timer.reset();
  }, [timer]);

  // A session ends if its task is completed or removed while the timer runs.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const task = workspace?.taskById(session.id);
    if (!task || task.isDone) {
      sessionRef.current = null;
      timer.reset();
    }
  }, [workspace, timer]);

  const value = useMemo<FocusTimerValue>(
    () => ({
      status: timer.status,
      remaining: timer.remaining,
      totalSeconds: timer.totalSeconds,
      progress: timer.progress,
      isRunning: timer.isRunning,
      sessionTaskId: sessionRef.current?.id ?? null,
      startForTask,
      toggleForTask,
      reset,
    }),
    [timer.status, timer.remaining, timer.totalSeconds, timer.progress, timer.isRunning, startForTask, toggleForTask, reset],
  );

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}

export function useFocusTimerContext(): FocusTimerValue {
  const value = useContext(FocusTimerContext);
  if (!value) throw new Error("useFocusTimerContext must be used inside FocusTimerProvider.");
  return value;
}
