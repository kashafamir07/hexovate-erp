import type { LucideIcon } from "lucide-react";

/** Sidebar / navigation model shared by every role. */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** route (empty while the page is not built yet) */
  to: string;
  /** live count badge, shown next to the label (e.g. Approvals Inbox) */
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SessionUser {
  name: string;
  role: string;
  initials: string;
  /** avatar background color (initials avatar, from Figma) */
  color: string;
}

export interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
}

export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "gray";

/** A person in the org (avatar initials + colors used across pages). */
export interface Person {
  initials: string;
  name: string;
  role: string;
  color: string;
}
