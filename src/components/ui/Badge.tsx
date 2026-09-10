import type { ReactNode } from "react";
import type { BadgeTone } from "../../types";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** Small status/priority pill (11px medium, 19px tall, radius 4). */
export function Badge({ tone, children, className = "" }: BadgeProps) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>;
}
