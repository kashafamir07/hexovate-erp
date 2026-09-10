import { apiGet } from "./client";

export interface OrgNode {
  id: string;
  initials: string;
  name: string;
  role: string;
  color: string;
  dept?: string;
  reports?: string[];
  reportsCount?: number;
}

export const orgApi = {
  chart: () => apiGet<{ root: OrgNode | null; nodes: Record<string, OrgNode> }>("/org-chart"),
};
