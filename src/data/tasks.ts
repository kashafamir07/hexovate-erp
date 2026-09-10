import type { BadgeTone } from "../types";

export type TaskStatus = "In Progress" | "In Review" | "To Do" | "Done";

export interface TaskRow {
  id: string;
  title: string;
  project: string;
  projectId: string;
  priority: "High" | "Medium" | "Low";
  due: string;
  dueLabel: "today" | "overdue" | "later";
  status: TaskStatus;
  done: boolean;
}

export const taskStatusTone: Record<TaskStatus, BadgeTone> = {
  "In Progress": "primary",
  "In Review": "violet",
  "To Do": "gray",
  Done: "success",
};

export const priorityTone: Record<TaskRow["priority"], BadgeTone> = {
  High: "danger",
  Medium: "warning",
  Low: "success",
};

/** My Tasks rows (Employee board 25). */
export const myTasks: TaskRow[] = [
  { id: "mt1", title: "Design pricing page", project: "Website Redesign", projectId: "website-redesign", priority: "Medium", due: "Oct 15", dueLabel: "today", status: "In Progress", done: false },
  { id: "mt2", title: "Write homepage copy review", project: "Website Redesign", projectId: "website-redesign", priority: "High", due: "Oct 14", dueLabel: "overdue", status: "In Review", done: false },
  { id: "mt3", title: "Set up SSO config", project: "ERP Implementation", projectId: "erp-implementation", priority: "High", due: "Oct 18", dueLabel: "later", status: "To Do", done: false },
  { id: "mt4", title: "QA mobile breakpoints", project: "Website Redesign", projectId: "website-redesign", priority: "Low", due: "Oct 20", dueLabel: "later", status: "To Do", done: false },
  { id: "mt5", title: "Approve vendor mockups", project: "Vendor Portal", projectId: "vendor-portal", priority: "Medium", due: "Oct 9", dueLabel: "overdue", status: "Done", done: true },
  { id: "mt6", title: "Update FAQ copy", project: "Website Redesign", projectId: "website-redesign", priority: "Low", due: "Oct 22", dueLabel: "later", status: "To Do", done: false },
];

export const taskFilters = [
  { id: "all", label: "All", count: 12 },
  { id: "today", label: "Due Today", count: 2 },
  { id: "overdue", label: "Overdue", count: 1 },
] as const;
