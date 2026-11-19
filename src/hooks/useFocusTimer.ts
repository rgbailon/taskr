import { useCallback, useEffect, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "paused";

export function useFocusTimer({
  durationMinutes,
  onComplete,
}: {
  durationMinutes: number;
  onComplete: (minutes: number) => void;
}) {
  const totalSeconds = Math.max(60, Math.round(durationMinutes * 60));
  const [remaining, setRemaining] = useState(totalSeconds);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const remainingRef = useRef(totalSeconds);
  const endAtRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      remainingRef.current = left;
      setRemaining(left);
      if (left <= 0) {
        setStatus("idle");
        remainingRef.current = totalSeconds;
        setRemaining(totalSeconds);
        onCompleteRef.current(Math.round(totalSeconds / 60));
      }
    };
    tick();
    const interval = window.setInterval(tick, 400);
    return () => window.clearInterval(interval);
  }, [status, totalSeconds]);

  useEffect(() => {
    if (status !== "idle") return;
    remainingRef.current = totalSeconds;
    setRemaining(totalSeconds);
  }, [status, totalSeconds]);

  const start = useCallback(() => {
    const base = remainingRef.current > 0 ? remainingRef.current : totalSeconds;
    endAtRef.current = Date.now() + base * 1000;
    setRemaining(base);
    setStatus("running");
  }, [totalSeconds]);

  const pause = useCallback(() => {
    setStatus("paused");
  }, []);

  const toggle = useCallback(() => {
    if (status === "running") pause();
    else start();
  }, [status, pause, start]);

  const reset = useCallback(() => {
    setStatus("idle");
    remainingRef.current = totalSeconds;
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  return {
    status,
    remaining,
    totalSeconds,
    progress: totalSeconds === 0 ? 0 : remaining / totalSeconds,
    start,
    pause,
    toggle,
    reset,
    isRunning: status === "running",
  };
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
