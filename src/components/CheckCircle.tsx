import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface CheckCircleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  label: string;
  size?: "sm" | "md";
}

export function CheckCircle({ checked, label, size = "md", className = "", ...rest }: CheckCircleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check-circle check-${size}${checked ? " is-checked" : ""} ${className}`.trim()}
      {...rest}
    >
      {checked ? <Icon name="check" size={size === "sm" ? 10 : 12} strokeWidth={2.4} /> : null}
    </button>
  );
}
