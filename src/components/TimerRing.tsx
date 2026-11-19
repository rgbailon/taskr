import { formatClock, type TimerStatus } from "../hooks/useFocusTimer";

export function TimerRing({
  remaining,
  total,
  status,
}: {
  remaining: number;
  total: number;
  status: TimerStatus;
}) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <div className={`timer-ring timer-${status}`}>
      <svg viewBox="0 0 108 108" role="img" aria-label={`Focus timer, ${formatClock(remaining)} remaining`}>
        <circle cx="54" cy="54" r="44" fill="none" stroke="var(--teal-track)" strokeWidth="5" />
        <circle
          cx="54"
          cy="54"
          r="44"
          fill="none"
          stroke="var(--teal)"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${fraction * 100} 100`}
          transform="rotate(-90 54 54)"
          className="timer-progress"
        />
      </svg>
      <div className="timer-copy">
        <strong>{formatClock(remaining)}</strong>
        <span>{status === "running" ? "IN FOCUS" : status === "paused" ? "PAUSED" : "FOCUS"}</span>
      </div>
    </div>
  );
}
