import {
  Activity,
  BarChart3,
  Bell,
  Lock,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  FileBarChart,
  FileText,
  FolderKanban,
  Gauge,
  Globe,
  History,
  Home,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Network,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCog,
  UserRound,
  UserRoundSearch,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavGroup, MobileTab } from "../types";

export type LeaderKind = "executive" | "manager" | "ceo" | "company_admin" | "super_admin";

export interface RoleConfig {
  kind: LeaderKind;
  base: string; // route prefix e.g. "/exec"
  label: string;
  /** Page-header title on the role dashboard. */
  dashTitle: string;
  /** Org-wide scope (whole company) vs department/team scoping. */
  orgWide: boolean;
  groups: NavGroup[];
  tabs: MobileTab[];
  home: string;
  peoplePath: string;
  settingsTo: string;
  canDecide: boolean; // approve/reject requests & write performance
  canEditPerformance: boolean;
}

/* Executive — "MD / EXECUTIVE" Figma nav (exact groups & labels) */
const execGroups: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/exec/dashboard" },
      { id: "org-overview", label: "Executive Overview", icon: Building2, to: "/exec/organization" },
    ],
  },
  {
    label: "ORGANIZATION",
    items: [
      { id: "departments", label: "Departments", icon: FolderKanban, to: "/exec/departments" },
      { id: "employees", label: "People", icon: Users, to: "/exec/employees" },
      { id: "org-chart", label: "Org Chart", icon: Network, to: "/exec/org-chart" },
    ],
  },
  {
    label: "WORK",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban, to: "/exec/projects" },
      { id: "my-tasks", label: "My Tasks", icon: CheckSquare, to: "/exec/my-tasks" },
      { id: "time-overview", label: "Time Overview", icon: Clock, to: "/exec/time" },
      { id: "time-logs", label: "Time Logs", icon: History, to: "/exec/time-logs" },
    ],
  },
  {
    label: "COMMS & REQUESTS",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/exec/messages" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/exec/announcements" },
      { id: "my-requests", label: "My Requests", icon: ClipboardList, to: "/exec/my-requests" },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/exec/approvals" },
    ],
  },
  {
    label: "REPORTING",
    items: [{ id: "reports", label: "Reports", icon: FileBarChart, to: "/exec/reports" }],
  },
  {
    label: "RESOURCES",
    items: [
      { id: "documents", label: "Documents", icon: FileText, to: "/exec/documents" },
      { id: "leave-attendance", label: "Leave & Attendance", icon: CalendarDays, to: "/exec/leaves" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { id: "company-settings", label: "Company Settings", icon: Settings, to: "/exec/company-settings" },
      { id: "profile", label: "Profile & Preferences", icon: UserRound, to: "/exec/settings" },
    ],
  },
];

const mgrGroups: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/manager/dashboard" }],
  },
  {
    label: "TEAM",
    items: [
      { id: "team", label: "My Team", icon: Users, to: "/manager/team" },
      { id: "structure", label: "Team Structure", icon: Network, to: "/manager/structure" },
    ],
  },
  {
    label: "WORK",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban, to: "/manager/projects" },
      { id: "tasks", label: "Team Tasks", icon: CheckSquare, to: "/manager/tasks" },
      { id: "kanban", label: "Kanban Board", icon: KanbanSquare, to: "/manager/kanban" },
      { id: "time", label: "Time", icon: Clock, to: "/manager/time" },
      { id: "attendance", label: "Attendance", icon: CalendarDays, to: "/manager/attendance" },
      { id: "calendar", label: "Team Calendar", icon: CalendarRange, to: "/manager/calendar" },
      { id: "workload", label: "Workload", icon: Gauge, to: "/manager/workload" },
    ],
  },
  {
    label: "MONITORING",
    items: [{ id: "monitoring", label: "Activity Monitoring", icon: Activity, to: "/manager/monitoring" }],
  },
  {
    label: "REQUESTS",
    items: [
      { id: "leaves", label: "Leave Requests", icon: ClipboardCheck, to: "/manager/leaves" },
      { id: "approvals", label: "Approvals", icon: ClipboardList, to: "/manager/approvals" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { id: "performance", label: "Performance", icon: TrendingUp, to: "/manager/performance" },
      { id: "reports", label: "Reports", icon: FileBarChart, to: "/manager/reports" },
    ],
  },
  {
    label: "COMMS",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/manager/messages" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/manager/announcements" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [{ id: "settings", label: "My Profile & Settings", icon: Settings, to: "/manager/settings" }],
  },
];

/* ---------------- CEO + Company Admin — exact Figma nav (MAIN/PEOPLE/WORK/COMMS/REQUESTS/ADMIN) ---------------- */

const ceoGroups: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/ceo/dashboard" },
      { id: "workspace", label: "Personal Workspace", icon: Home, to: "/ceo/workspace" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { id: "employees", label: "Employees", icon: Users, to: "/ceo/employees" },
      { id: "org-chart", label: "Org Chart", icon: Network, to: "/ceo/org-chart" },
      { id: "departments", label: "Departments", icon: Building2, to: "/ceo/departments" },
    ],
  },
  {
    label: "WORK",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban, to: "/ceo/projects" },
      { id: "my-tasks", label: "My Tasks", icon: CheckSquare, to: "/ceo/my-tasks" },
      { id: "time-tracker", label: "Time Tracker", icon: Clock, to: "/ceo/time-tracker" },
    ],
  },
  {
    label: "COMMS",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/ceo/messages" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/ceo/announcements" },
    ],
  },
  {
    label: "REQUESTS",
    items: [
      { id: "my-requests", label: "My Requests", icon: ClipboardList, to: "/ceo/my-requests" },
      { id: "approvals", label: "Approvals Inbox", icon: ClipboardCheck, to: "/ceo/approvals" },
    ],
  },
  {
    label: "ADMIN",
    items: [{ id: "roles", label: "Roles & Permissions", icon: ShieldCheck, to: "/ceo/roles" }],
  },
];

const caGroups: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/ca/dashboard" },
      { id: "workspace", label: "Personal Workspace", icon: Home, to: "/ca/workspace" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { id: "employees", label: "Employees", icon: Users, to: "/ca/employees" },
      { id: "org-chart", label: "Org Chart", icon: Network, to: "/ca/org-chart" },
      { id: "departments", label: "Departments", icon: Building2, to: "/ca/departments" },
    ],
  },
  {
    label: "WORK",
    items: [
      { id: "projects", label: "Projects", icon: FolderKanban, to: "/ca/projects" },
      { id: "my-tasks", label: "My Tasks", icon: CheckSquare, to: "/ca/my-tasks" },
      { id: "time-tracker", label: "Time Tracker", icon: Clock, to: "/ca/time-tracker" },
    ],
  },
  {
    label: "COMMS",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/ca/messages" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/ca/announcements" },
    ],
  },
  {
    label: "REQUESTS",
    items: [
      { id: "my-requests", label: "My Requests", icon: ClipboardList, to: "/ca/my-requests" },
      { id: "approvals", label: "Approvals Inbox", icon: ClipboardCheck, to: "/ca/approvals" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { id: "roles", label: "Roles & Permissions", icon: ShieldCheck, to: "/ca/roles" },
      { id: "users", label: "User Management", icon: UserCog, to: "/ca/users" },
      { id: "company-settings", label: "Company Settings", icon: Settings, to: "/ca/company-settings" },
    ],
  },
];

/* ---------------- Super Admin — platform administration (multi-tenant) ---------------- */

/* ---------------- Super Admin — exact Figma PLATFORM/TENANTS/ACCESS/SUBSCRIPTIONS/OPERATIONS/ACCOUNT nav ---------------- */

const saGroups: NavGroup[] = [
  {
    label: "PLATFORM",
    items: [
      { id: "dashboard", label: "Platform Dashboard", icon: LayoutDashboard, to: "/sa/dashboard" },
      { id: "companies", label: "Companies", icon: Building2, to: "/sa/companies" },
      { id: "search", label: "Global Search", icon: UserRoundSearch, to: "/sa/search" },
    ],
  },
  {
    label: "TENANTS",
    items: [
      { id: "org-overview", label: "Company Overview", icon: Globe, to: "/sa/organization" },
      { id: "employees", label: "Company Team", icon: Users, to: "/sa/employees" },
      { id: "company-roles", label: "Company Roles", icon: ShieldCheck, to: "/sa/roles" },
    ],
  },
  {
    label: "ACCESS",
    items: [
      { id: "role-templates", label: "Role Templates", icon: FileText, to: "/sa/role-templates" },
      { id: "super-admins", label: "Super Admins", icon: UserCog, to: "/sa/super-admins" },
      { id: "security", label: "Security & Access", icon: Lock, to: "/sa/security" },
    ],
  },
  {
    label: "SUBSCRIPTIONS",
    items: [
      { id: "subscriptions", label: "Subscriptions", icon: CreditCard, to: "/sa/subscriptions" },
      { id: "subscription-plans", label: "Subscription Plans", icon: Wallet, to: "/sa/plans" },
      { id: "assign-subscription", label: "Assign Subscription", icon: ClipboardCheck, to: "/sa/assign" },
      { id: "billing", label: "Billing & Payments", icon: History, to: "/sa/billing" },
      { id: "invoice-detail", label: "Invoice Detail", icon: FileText, to: "/sa/invoices" },
      { id: "lifecycle", label: "Subscription Lifecycle", icon: TrendingUp, to: "/sa/lifecycle" },
      { id: "usage", label: "Usage & Limits", icon: Gauge, to: "/sa/usage" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "platform-activity", label: "Platform Activity", icon: Activity, to: "/sa/platform-activity" },
      { id: "audit", label: "Audit Logs", icon: History, to: "/sa/audit" },
      { id: "support", label: "Support & Tickets", icon: LifeBuoy, to: "/sa/support" },
      { id: "announcements", label: "Announcements", icon: Megaphone, to: "/sa/announcements" },
      { id: "system", label: "System Health", icon: Gauge, to: "/sa/system" },
      { id: "integrations", label: "Integrations", icon: Network, to: "/sa/integrations" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { id: "profile", label: "Super Admin Profile", icon: UserRound, to: "/sa/profile" },
      { id: "notifications", label: "Notifications", icon: Bell, to: "/sa/notifications" },
    ],
  },
];

export const roleConfigs: Record<LeaderKind, RoleConfig> = {
  executive: {
    kind: "executive",
    base: "/exec",
    label: "Executive",
    dashTitle: "MD / Executive",
    orgWide: true,
    groups: execGroups,
    tabs: [
      { id: "home", label: "Home", icon: Home, to: "/exec/dashboard" },
      { id: "people", label: "People", icon: Users, to: "/exec/employees" },
      { id: "work", label: "Tasks", icon: CheckSquare, to: "/exec/my-tasks" },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/exec/approvals" },
      { id: "reports", label: "Reports", icon: FileBarChart, to: "/exec/reports" },
    ],
    home: "/exec/dashboard",
    peoplePath: "/exec/employees",
    settingsTo: "/exec/settings",
    canDecide: false,
    canEditPerformance: false,
  },
  manager: {
    kind: "manager",
    base: "/manager",
    label: "Manager",
    dashTitle: "Manager Dashboard",
    orgWide: false,
    groups: mgrGroups,
    tabs: [
      { id: "home", label: "Home", icon: Home, to: "/manager/dashboard" },
      { id: "team", label: "Team", icon: Users, to: "/manager/team" },
      { id: "tasks", label: "Tasks", icon: CheckSquare, to: "/manager/tasks" },
      { id: "approvals", label: "Approvals", icon: ClipboardList, to: "/manager/approvals" },
      { id: "inbox", label: "Reports", icon: FileBarChart, to: "/manager/reports" },
    ],
    home: "/manager/dashboard",
    peoplePath: "/manager/team",
    settingsTo: "/manager/settings",
    canDecide: true,
    canEditPerformance: true,
  },
  ceo: {
    kind: "ceo",
    base: "/ceo",
    label: "CEO",
    dashTitle: "CEO Dashboard",
    orgWide: true,
    groups: ceoGroups,
    tabs: [
      { id: "home", label: "Home", icon: Home, to: "/ceo/dashboard" },
      { id: "people", label: "People", icon: Users, to: "/ceo/employees" },
      { id: "work", label: "Tasks", icon: CheckSquare, to: "/ceo/my-tasks" },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/ceo/approvals" },
      { id: "requests", label: "Requests", icon: ClipboardList, to: "/ceo/my-requests" },
    ],
    home: "/ceo/dashboard",
    peoplePath: "/ceo/employees",
    settingsTo: "/ceo/my-requests",
    canDecide: true,
    canEditPerformance: false,
  },
  company_admin: {
    kind: "company_admin",
    base: "/ca",
    label: "Company Admin",
    dashTitle: "Company Admin Dashboard",
    orgWide: true,
    groups: caGroups,
    tabs: [
      { id: "home", label: "Home", icon: Home, to: "/ca/dashboard" },
      { id: "people", label: "People", icon: Users, to: "/ca/employees" },
      { id: "work", label: "Tasks", icon: CheckSquare, to: "/ca/my-tasks" },
      { id: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/ca/approvals" },
      { id: "requests", label: "Requests", icon: ClipboardList, to: "/ca/my-requests" },
    ],
    home: "/ca/dashboard",
    peoplePath: "/ca/employees",
    settingsTo: "/ca/company-settings",
    canDecide: true,
    canEditPerformance: true,
  },
  super_admin: {
    kind: "super_admin",
    base: "/sa",
    label: "Super Admin",
    dashTitle: "Platform Dashboard",
    orgWide: true,
    groups: saGroups,
    tabs: [
      { id: "home", label: "Home", icon: Home, to: "/sa/dashboard" },
      { id: "companies", label: "Companies", icon: Building2, to: "/sa/companies" },
      { id: "search", label: "Search", icon: UserRoundSearch, to: "/sa/search" },
      { id: "support", label: "Support", icon: LifeBuoy, to: "/sa/support" },
      { id: "audit", label: "Audit", icon: History, to: "/sa/audit" },
    ],
    home: "/sa/dashboard",
    peoplePath: "/sa/employees",
    settingsTo: "/sa/profile",
    canDecide: true,
    canEditPerformance: true,
  },
};

export const ORG_KINDS: LeaderKind[] = ["executive", "ceo", "company_admin", "super_admin"];

/** Org-wide leader kinds (whole-company scope, vs department/team). */
export const isOrgKind = (kind: LeaderKind): boolean => ORG_KINDS.includes(kind);

const KIND_BY_ROLE: Record<string, LeaderKind> = {
  executive: "executive",
  manager: "manager",
  ceo: "ceo",
  company_admin: "company_admin",
  super_admin: "super_admin",
};

export const leaderRoleOf = (role: string): LeaderKind | null => KIND_BY_ROLE[role] || null;

export const roleHomeOf = (role: string): string => {
  const kind = leaderRoleOf(role);
  return kind ? roleConfigs[kind].home : LEADER_HOME[role] || "/dashboard";
};

export const LEADER_HOME: Record<string, string> = {
  employee: "/dashboard",
  manager: "/manager/dashboard",
  executive: "/exec/dashboard",
  ceo: "/ceo/dashboard",
  company_admin: "/ca/dashboard",
  super_admin: "/sa/dashboard",
  admin: "/dashboard",
  hr: "/hr/dashboard",
};

/** Find active nav item + crumb for a path inside a role config. */
export function resolveRouteMeta(cfg: RoleConfig, pathname: string): { crumb: string; activeId: string; title: string } {
  let best: { id: string; label: string; to: string } | null = null;
  for (const group of cfg.groups) {
    for (const item of group.items) {
      if (pathname === item.to) {
        best = item;
        break;
      }
      if (pathname.startsWith(`${item.to}/`)) best = item;
    }
    if (best) break;
  }
  if (!best) return { crumb: cfg.label, activeId: "dashboard", title: cfg.label };
  return { crumb: best.label, activeId: best.id, title: best.label };
}

export const extraIcons: Record<string, LucideIcon> = {
  inbox: Inbox,
  message: MessageSquare,
  target: Target,
  gauge: Gauge,
  shield: ShieldCheck,
  bar: BarChart3,
  user: UserRound,
};
