import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "soft" | "ghost" | "white" | "danger-soft";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/**
 * Buttons follow the design sheet: 8px radius; primary navy, soft indigo
 * (used for chips/secondary actions), white (on navy cards).
 */
export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={`btn btn--${variant} btn--${size} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
