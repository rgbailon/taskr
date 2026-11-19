import type { SVGProps } from "react";

export type IconName =
  | "focus"
  | "inbox"
  | "calendar"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "arrow-left"
  | "arrow-right"
  | "play"
  | "pause"
  | "reset"
  | "search"
  | "keyboard"
  | "note"
  | "target"
  | "spark"
  | "check"
  | "close"
  | "more"
  | "trash"
  | "export"
  | "refresh"
  | "folder"
  | "clock"
  | "list"
  | "flag"
  | "sun"
  | "moon"
  | "monitor";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      {...rest}
    >
      {label ? <title>{label}</title> : null}
      {renderPath(name)}
    </svg>
  );
}

function renderPath(name: IconName) {
  switch (name) {
    case "focus":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.4V12l3.1 2" />
        </>
      );
    case "inbox":
      return (
        <>
          <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="3.1" />
          <path d="M8.3 11.8l2.5 2.5 4.9-5.1" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="4" y="5.4" width="16" height="14.6" rx="2.4" />
          <path d="M4 10h16M8.2 3.4v4M15.8 3.4v4" />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "chevron-left":
      return <path d="M14.5 6l-6 6 6 6" />;
    case "chevron-right":
      return <path d="M9.5 6l6 6-6 6" />;
    case "chevron-down":
      return <path d="M6 9.5l6 6 6-6" />;
    case "arrow-left":
      return (
        <>
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </>
      );
    case "play":
      return <path d="M8.2 5.4v13.2L19 12z" fill="currentColor" stroke="none" />;
    case "pause":
      return (
        <>
          <path d="M9 5.8v12.4M15 5.8v12.4" strokeWidth="2" />
        </>
      );
    case "reset":
      return (
        <>
          <path d="M4.2 10.2a8 8 0 1 1 2.3 7.2" />
          <path d="M4.2 5.2v5h5" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.8" />
          <path d="M16 16l4.6 4.6" />
        </>
      );
    case "keyboard":
      return (
        <>
          <rect x="3" y="6.5" width="18" height="11" rx="2.2" />
          <path d="M6.3 10h.01M9.6 10h.01M12.9 10h.01M16.2 10h.01M6.3 13.4h.01M9.6 13.4h.01M12.9 13.4h.01M16.2 13.4h.01M7.5 16.4h9" />
        </>
      );
    case "note":
      return (
        <>
          <path d="M6 3.6h8.5L19 8.4v12H6z" />
          <path d="M14.2 3.8v4.8h4.6M9 12.4h6M9 15.6h4.4" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="7.6" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M12 4l1.7 5.1L19 11l-5.3 1.9L12 18l-1.7-5.1L5 11l5.3-1.9z" />
          <path d="M18.4 17.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
        </>
      );
    case "check":
      return <path d="M5 12.5l4.4 4.4L19 6.6" />;
    case "close":
      return <path d="M6 6l12 12M18 6L6 18" />;
    case "more":
      return (
        <>
          <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
    case "trash":
      return (
        <>
          <path d="M4.5 6.8h15M9.3 6.8V4.6h5.4v2.2M6.4 6.8l.8 13h9.6l.8-13M10 10.6v5.8M14 10.6v5.8" />
        </>
      );
    case "export":
      return (
        <>
          <path d="M12 15.5V4.5M7.8 8.6L12 4.4l4.2 4.2" />
          <path d="M5 14.5v3.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-3.2" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 11.4A8 8 0 0 0 6.3 6.6L4.4 8.4" />
          <path d="M4.4 4.4v4h4M4 12.6a8 8 0 0 0 13.7 4.8l1.9-1.8" />
          <path d="M19.6 19.6v-4h-4" />
        </>
      );
    case "folder":
      return <path d="M3.4 7.4a2 2 0 0 1 2-2h4l2 2.4h7.2a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" />;
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5.2l3.4 2" />
        </>
      );
    case "list":
      return (
        <>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4.2 6h.01M4.2 12h.01M4.2 18h.01" />
        </>
      );
    case "flag":
      return <path d="M6 21V4h5l1 2h6l-1.7 5L18 16h-6l-1-2H6" />;
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.8v2.4M12 18.8v2.4M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7" />
        </>
      );
    case "moon":
      return <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z" />;
    case "monitor":
      return (
        <>
          <rect x="3.2" y="4.6" width="17.6" height="12" rx="2.2" />
          <path d="M9 20.4h6M12 16.6v3.8" />
        </>
      );
    default:
      return null;
  }
}
