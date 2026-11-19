import type { CSSProperties } from "react";

export function ProjectMark({
  color,
  size = 26,
  muted = false,
}: {
  color: string;
  size?: number;
  muted?: boolean;
}) {
  return (
    <span
      className={`project-mark${muted ? " is-muted" : ""}`}
      style={
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          background: muted ? "color-mix(in srgb, var(--mark-color) 18%, white)" : color,
          "--mark-color": color,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none">
        <path
          d="M12 6v12M6 12h12"
          stroke={muted ? color : "#FFFFFF"}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function ProjectDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="project-dot"
      style={{ width: size, height: size, background: color }}
      aria-hidden="true"
    />
  );
}
