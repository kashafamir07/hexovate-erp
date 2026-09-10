import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

const qs = (params?: Record<string, string | number | undefined>) => {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface PlatformKpi {
  id: string;
  label: string;
  value: string;
  note: string;
  sub: string;
  delta: { pct: number; dir: "up" | "down"; note: string; good: boolean } | null;
}

export interface PlatformChartPoint {
  label: string;
  value: number;
}

export interface PlatformActivity {
  id: string;
  actor: string;
  category: string;
  action: string;
  targetType: string;
  targetName: string;
  detail: string;
  createdLabel: string;
}

export interface PlatformCompany {
  id: string;
  name: string;
  domain: string;
  industry: string;
  plan: string;
  planLabel: string;
  status: string;
  seats: number;
  seatsUsed: number;
  contactName: string;
  contactEmail: string;
  renewalDate: string | null;
  renewalLabel: string;
  mrr: number;
  mrrLabel: string;
  notes: string;
  createdAt: string | null;
  createdLabel: string;
}

export interface PlatformTicket {
  id: string;
  company: string | null;
  companyName: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  statusLabel: string;
  reporter: string;
  assignee: string;
  createdLabel: string;
  updatedLabel: string;
}

export interface AuditRow extends PlatformActivity {}

export interface PlatformInvoice {
  id: string;
  number: string;
  company: string;
  companyId: string;
  plan: string;
  planLabel: string;
  amount: number;
  amountLabel: string;
  status: string;
  issued: string;
  due: string;
  paid: string;
  method: string;
}

export interface LifecycleCompany {
  id: string;
  name: string;
  plan: string;
  planLabel: string;
  status: string;
  seats: number;
  seatsUsed: number;
  mrr: number;
  renewal: string;
  contact: string;
}

export interface UsageRow {
  id: string;
  name: string;
  plan: string;
  planLabel: string;
  seats: number;
  seatsUsed: number;
  seatsPct: number;
  projects: number;
  mrr: number;
  status: string;
}

export interface RoleTemplateRow {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system: boolean;
}

export interface SuperAdminRow {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  lastLogin: string | null;
  joinedAt: string | null;
}

export interface SecuritySettings {
  twoFactorRequired: boolean;
  sessionTimeoutMin: number;
  passwordMinLength: number;
  allowSignups: boolean;
  maintenanceMode: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface IntegrationRow {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
  connectedAt: string | null;
}

export const platformApi = {
  dashboard: () =>
    apiGet<{
      kpis: PlatformKpi[];
      planMix: PlatformChartPoint[];
      signups: PlatformChartPoint[];
      activity: PlatformActivity[];
      totals: { companies: number; active: number; trials: number; suspended: number; seats: number; auditEntries: number; openTickets: number };
    }>("/platform/dashboard"),

  companies: (params?: Record<string, string | number>) =>
    apiGet<{
      items: PlatformCompany[];
      pagination: { page: number; limit: number; total: number; pages: number };
      summary: { total: number; active: number; mrr: number; open: number };
    }>(`/platform/companies${qs(params)}`),
  company: (id: string) =>
    apiGet<{ company: PlatformCompany; tickets: PlatformTicket[]; audit: AuditRow[] }>(`/platform/companies/${id}`),
  createCompany: (body: Record<string, unknown>) => apiPost<{ company: PlatformCompany }>("/platform/companies", body).then((d) => d.company),
  updateCompany: (id: string, body: Record<string, unknown>) => apiPatch<{ company: PlatformCompany }>(`/platform/companies/${id}`, body).then((d) => d.company),
  deleteCompany: (id: string) => apiDelete<null>(`/platform/companies/${id}`),

  subscriptions: () =>
    apiGet<{
      summary: { mrr: number; active: number; activeRate: number; renewingSoon: number; seats: number; seatsUsed: number };
      byPlan: { plan: string; label: string; rate: number; count: number; mrr: number }[];
      mrrTrend: PlatformChartPoint[];
      items: PlatformCompany[];
    }>("/platform/subscriptions"),

  audit: (params?: Record<string, string | number>) =>
    apiGet<{ items: AuditRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/platform/audit${qs(params)}`),

  tickets: (params?: Record<string, string | number>) =>
    apiGet<{
      items: PlatformTicket[];
      pagination: { page: number; limit: number; total: number; pages: number };
      summary: { open: number; critical: number; resolved: number };
    }>(`/platform/tickets${qs(params)}`),
  createTicket: (body: Record<string, unknown>) => apiPost<{ ticket: PlatformTicket }>("/platform/tickets", body).then((d) => d.ticket),
  updateTicket: (id: string, body: Record<string, unknown>) => apiPatch<{ ticket: PlatformTicket }>(`/platform/tickets/${id}`, body).then((d) => d.ticket),

  health: () =>
    apiGet<{
      services: { name: string; status: string; detail: string; latency: string }[];
      storage: { users: number; activeUsers: number; projects: number; tasks: number; departments: number; companies: number; tickets: number; auditEntries: number };
      incidents: number;
      checkedAt: string;
    }>("/platform/health"),

  /* ---------- extended Super Admin pages ---------- */

  invoices: (params?: Record<string, string | number>) =>
    apiGet<{
      items: PlatformInvoice[];
      summary: { collected: number; outstanding: number; invoices: number; paid: number; open: number };
    }>(`/platform/invoices${qs(params)}`),

  latestInvoice: (id?: string) =>
    apiGet<{ invoice: PlatformInvoice; history: PlatformInvoice[] }>(`/platform/invoices/latest${qs(id ? { id } : undefined)}`),

  lifecycle: () =>
    apiGet<{
      stages: { key: string; label: string; count: number }[];
      companies: LifecycleCompany[];
      events: PlatformActivity[];
    }>("/platform/subscription-lifecycle"),

  usage: () =>
    apiGet<{ items: UsageRow[] }>("/platform/usage"),

  activity: (limit = 30) =>
    apiGet<{ items: PlatformActivity[] }>(`/platform/activity${qs({ limit })}`),

  roleTemplates: () => apiGet<{ items: RoleTemplateRow[] }>("/platform/role-templates"),
  createRoleTemplate: (body: Record<string, unknown>) =>
    apiPost<{ template: RoleTemplateRow }>("/platform/role-templates", body).then((d) => d.template),
  deleteRoleTemplate: (id: string) => apiDelete<null>(`/platform/role-templates/${id}`),

  superAdmins: () => apiGet<{ items: SuperAdminRow[] }>("/platform/super-admins"),
  patchSuperAdmin: (id: string, body: Record<string, unknown>) =>
    apiPatch<{ updated: { id: string; status: string } }>(`/platform/super-admins/${id}`, body),

  security: () => apiGet<{ settings: SecuritySettings }>("/platform/security"),
  patchSecurity: (body: Record<string, unknown>) =>
    apiPatch<{ settings: SecuritySettings }>("/platform/security", body).then((d) => d.settings),

  integrations: () => apiGet<{ items: IntegrationRow[] }>("/platform/integrations"),
  patchIntegration: (key: string, connected: boolean) =>
    apiPatch<{ integration: { id: string; key: string; name: string; connected: boolean } }>(`/platform/integrations/${key}`, { connected }),

  globalSearch: (q: string) =>
    apiGet<{
      query: string;
      companies: { id: string; name: string; plan: string; status: string; sub: string }[];
      people: { id: string; name: string; sub: string; role: string; status: string }[];
      tickets: { id: string; subject: string; sub: string; status: string; priority: string }[];
    }>(`/platform/global-search${qs({ q })}`),

  assignPlan: (id: string, plan: string) =>
    apiPatch<{ company: { id: string; name: string; plan: string } }>(`/platform/companies/${id}/plan`, { plan }),
};

export const COMPANY_PLAN_TONE: Record<string, "primary" | "success" | "warning"> = {
  enterprise: "primary",
  business: "success",
  trial: "warning",
};

export const TICKET_STATUS_TONE: Record<string, "success" | "warning" | "primary" | "gray"> = {
  open: "warning",
  in_progress: "primary",
  resolved: "success",
  closed: "gray",
};

export const TICKET_PRIORITY_TONE: Record<string, "danger" | "warning" | "primary" | "gray"> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "gray",
};
