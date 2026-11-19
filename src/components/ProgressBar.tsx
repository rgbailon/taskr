export function ProgressBar({
  value,
  color,
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      className="progress-track"
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <span
        className="progress-fill"
        style={{
          width: `${clamped * 100}%`,
          background: color ?? "var(--teal)",
        }}
      />
    </div>
  );
}
