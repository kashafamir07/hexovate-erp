import {
  Bell,
  CheckSquare,
  Clock,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Share2,
  User,
} from "lucide-react";
import type { MobileTab, NavGroup, SessionUser } from "../types";

/**
 * Employee / General User role (Jordan Cole).
 * Sidebar items + routes transcribed from the Figma Employee screens.
 */
export const employeeNav: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
      { id: "workspace", label: "Personal Workspace", icon: User, to: "/workspace" },
    ],
  },
  {
    label: "PEOPLE",
    items: [{ id: "org-chart", label: "Org Chart", icon: Share2, to: "/org-chart" }],
  },
  {
    label: "WORK",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban, to: "/projects" },
      { id: "my-tasks", label: "My Tasks", icon: CheckSquare, to: "/my-tasks" },
      { id: "time-tracker", label: "Time Tracker", icon: Clock, to: "/time-tracker" },
    ],
  },
  {
    label: "COMMS",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/messages" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/announcements" },
    ],
  },
  {
    label: "REQUESTS",
    items: [{ id: "my-requests", label: "My Requests", icon: FileText, to: "/my-requests" }],
  },
];

export const employeeUser: SessionUser = {
  name: "Jordan Cole",
  role: "Employee",
  initials: "JC",
  color: "#1F3C88",
};

/** Mobile bottom tab bar (Employee, from the Figma 390px boards). */
export const employeeMobileTabs: MobileTab[] = [
  { id: "home", label: "Home", icon: Home, to: "/dashboard" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, to: "/my-tasks" },
  { id: "time", label: "Time", icon: Clock, to: "/time-tracker" },
  { id: "requests", label: "Requests", icon: FileText, to: "/my-requests" },
  { id: "inbox", label: "Inbox", icon: Inbox, to: "/messages" },
];

export const bellIcon = Bell;

/* ---------- Notifications (bell) ---------- */
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: "task" | "approval" | "mention" | "announcement";
  /** set when the user has opened/dismissed it (mock read state) */
  read?: boolean;
}

/** Bell notifications (Employee board 43). */
export const defaultNotifications: NotificationItem[] = [
  { id: "n1", title: "Task assigned to you", body: 'Sarah assigned "Update FAQ copy"', time: "10 min ago", icon: "task" },
  { id: "n2", title: "Leave request approved", body: "Oct 21–25 vacation approved", time: "1 hour ago", icon: "approval" },
  { id: "n3", title: "New mention", body: "Sarah mentioned you in #website-redesign", time: "2 hours ago", icon: "mention" },
  { id: "n4", title: "New announcement", body: "Office closed Nov 28", time: "1 day ago", icon: "announcement" },
];
