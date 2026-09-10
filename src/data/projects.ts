import type { BadgeTone, Person } from "../types";

export type ProjectStatus = "Active" | "On Hold" | "Completed";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  due: string;
  dateRange: string;
  members: Person[];
  memberTotal: number;
}

const SJ = { initials: "SJ", name: "Sarah Jenkins", role: "", color: "#2E86AB" };
const MC = { initials: "MC", name: "Mike Chen", role: "", color: "#16A34A" };

/** Project cards (Employee board 17). */
export const projects: Project[] = [
  {
    id: "website-redesign",
    name: "Website Redesign",
    description: "Full marketing site rebuild with new brand system",
    status: "Active",
    progress: 75,
    due: "Oct 24",
    dateRange: "Oct 1 – Oct 24",
    members: [SJ, MC],
    memberTotal: 5,
  },
  {
    id: "erp-implementation",
    name: "ERP Implementation",
    description: "Internal rollout of Hexovate modules company-wide",
    status: "Active",
    progress: 30,
    due: "Nov 30",
    dateRange: "Sep 15 – Nov 30",
    members: [SJ, MC],
    memberTotal: 5,
  },
  {
    id: "mobile-app-v2",
    name: "Mobile App v2",
    description: "Native app refresh for employee self-service",
    status: "On Hold",
    progress: 48,
    due: "Dec 15",
    dateRange: "Oct 10 – Dec 15",
    members: [SJ, MC],
    memberTotal: 5,
  },
  {
    id: "q4-campaign",
    name: "Q4 Campaign",
    description: "Cross-channel product launch campaign",
    status: "Active",
    progress: 62,
    due: "Nov 8",
    dateRange: "Oct 5 – Nov 8",
    members: [SJ, MC],
    memberTotal: 5,
  },
  {
    id: "vendor-portal",
    name: "Vendor Portal",
    description: "Self-serve portal for external vendors",
    status: "Completed",
    progress: 100,
    due: "Sep 30",
    dateRange: "Aug 1 – Sep 30",
    members: [SJ, MC],
    memberTotal: 5,
  },
  {
    id: "design-system-2",
    name: "Design System 2.0",
    description: "Component library and token refresh",
    status: "Active",
    progress: 40,
    due: "Dec 1",
    dateRange: "Nov 1 – Dec 1",
    members: [SJ, MC],
    memberTotal: 5,
  },
];

export const projectStatusTone: Record<ProjectStatus, BadgeTone> = {
  Active: "primary",
  "On Hold": "warning",
  Completed: "success",
};

/* ---------- Project detail (board 19) ---------- */
export interface ProjectStats {
  total: number;
  completed: number;
  overdue: number;
  inReview: number;
}

export const projectStats: ProjectStats = { total: 48, completed: 36, overdue: 4, inReview: 6 };

export const budget = { spent: "$34,000", total: "$50,000", pct: 68 };

export const projectActivity = [
  { text: "Sarah moved Homepage Copy to In Review" },
  { text: "Jordan uploaded Wireframes_v3.fig" },
];

/* ---------- Kanban board (board 21) ---------- */
export type BoardStatus = "Backlog" | "To Do" | "In Progress" | "In Review" | "Done";

export interface BoardTask {
  id: string;
  title: string;
  tag: string;
  due: string;
  initials: string;
  color: string;
  /** left accent bar color on the card */
  accent: string;
}

export const boardColumns: { status: BoardStatus; tasks: BoardTask[] }[] = [
  {
    status: "Backlog",
    tasks: [
      { id: "t1", title: "Competitor audit", tag: "Research", due: "Due Oct 18", initials: "AR", color: "#1F3C88", accent: "#16A34A" },
      { id: "t2", title: "SEO keyword list", tag: "Marketing", due: "Due Oct 20", initials: "TB", color: "#1F3C88", accent: "#16A34A" },
    ],
  },
  {
    status: "To Do",
    tasks: [
      { id: "t3", title: "Design pricing page", tag: "Design", due: "Due Oct 15", initials: "JC", color: "#1F3C88", accent: "#B45309" },
      { id: "t4", title: "Write homepage copy", tag: "Content", due: "Due Oct 14", initials: "SJ", color: "#1F3C88", accent: "#DC2626" },
    ],
  },
  {
    status: "In Progress",
    tasks: [
      { id: "t5", title: "Build nav component", tag: "Frontend", due: "Due Oct 13", initials: "DK", color: "#1F3C88", accent: "#DC2626" },
      { id: "t6", title: "Mobile breakpoints", tag: "Design", due: "Due Oct 16", initials: "JC", color: "#1F3C88", accent: "#B45309" },
    ],
  },
  {
    status: "In Review",
    tasks: [
      { id: "t7", title: "Homepage wireframes", tag: "Design", due: "Due Oct 12", initials: "JC", color: "#1F3C88", accent: "#B45309" },
    ],
  },
  {
    status: "Done",
    tasks: [
      { id: "t8", title: "Brand color tokens", tag: "Design", due: "Due Oct 8", initials: "JC", color: "#1F3C88", accent: "#16A34A" },
      { id: "t9", title: "Kickoff deck", tag: "Marketing", due: "Due Oct 2", initials: "SJ", color: "#1F3C88", accent: "#16A34A" },
    ],
  },
];

export const boardColumnCount: Record<BoardStatus, number> = {
  Backlog: 5,
  "To Do": 4,
  "In Progress": 3,
  "In Review": 2,
  Done: 6,
};
