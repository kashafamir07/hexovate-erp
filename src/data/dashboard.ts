import type { BadgeTone } from "../types";

/**
 * Types + static UI constants for the Dashboard widgets.
 * Row data is served by GET /api/dashboard (see src/api/dashboard.ts).
 */

export interface TaskItem {
  title: string;
  meta: string;
  priority: BadgeTone;
  priorityLabel: string;
  checked: boolean;
}

export interface ProjectItem {
  name: string;
  meta: string; // "2 hours ago" / "Yesterday"
  progress: number; // percent 0-100
  pctLabel: string; // "75% complete"
  /** Mobile variant puts the bare % on the title row and omits the label. */
  mobilePct: string; // "75%"
}

export interface ActivityItem {
  initials: string;
  color: string;
  text: string;
  /** trailing bold phrase (task name), e.g. "Homepage Copy" */
  accent?: string;
  time: string;
}

export interface StatItem {
  value: string;
  label: string;
  badge?: string;
}

export interface DeadlineItem {
  task: string;
  project: string;
  due: string;
}

export interface TeamMember {
  initials: string;
  color: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: "plus" | "clock" | "calendar" | "receipt";
}

/** Bottom-right quick dock (desktop Dashboard) / FAB sheet (mobile). */
export const quickActions: QuickAction[] = [
  { id: "new-task", label: "New Task", icon: "plus" },
  { id: "log-time", label: "Log Time", icon: "clock" },
  { id: "leave", label: "Leave", icon: "calendar" },
  { id: "expense", label: "Expense", icon: "receipt" },
];
