import { apiGet } from "./client";
import type {
  ActivityItem,
  DeadlineItem,
  ProjectItem,
  StatItem,
  TaskItem,
  TeamMember,
} from "../data/dashboard";

export interface DashboardPayload {
  user: { firstName: string; name: string; initials: string; color: string; jobTitle: string; department: string; location: string };
  welcome: { greeting: string; subtitle: string; dateDesktop: string; weatherDesktop: string; dateMobile: string };
  todaysTasks: TaskItem[];
  activeProjects: ProjectItem[];
  recentActivity: ActivityItem[];
  statItems: StatItem[];
  upcomingDeadlines: DeadlineItem[];
  teamOnline: TeamMember[];
  mobileStats: StatItem[];
  counts: { pendingRequests: number; unreadNotifications: number; runningTimer: boolean };
}

export const dashboardApi = {
  get: () => apiGet<{ dashboard: DashboardPayload }>("/dashboard").then((d) => d.dashboard),
};
