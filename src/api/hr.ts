import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

const qs = (params?: Record<string, string | number | undefined>) => {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/* ---------- shared shapes ---------- */

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  employeeId?: string;
  jobTitle?: string;
  departmentName?: string;
  departmentId?: string | null;
  role?: string;
}

export interface Delta {
  pct: number;
  dir: "up" | "down" | "flat";
  note: string;
  good: boolean | null;
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
  note: string;
  sub: string;
  delta: Delta | null;
  /** Absolute (non-percent) trend line, e.g. "▲ 4 this week" — manager dashboard. */
  trend?: { dir: "up" | "down" | "flat"; label: string; good: boolean | null } | null;
}

export interface ManagerDashboardData {
  tasksDueToday: { id: string; title: string; project: string; assignee: Person | null; priority: string; priorityKey: string }[];
  activeProjects: { id: string; name: string; dueDate: string | null; dueLabel: string; progress: number }[];
  recentActivity: { id: string; initials: string; color: string; text: string; time: string }[];
  pendingGroups: { id: string; label: string; count: number; to: string }[];
  upcomingDeadlines: { id: string; title: string; project: string; date: string }[];
  teamOnline: { count: number; total: number; people: Person[] };
  attendanceSummary: { label: string; value: number; note: string }[];
}

export interface ChartPoint {
  label: string;
  value: number;
  key?: string;
}

/** CEO ("MD / Executive") dashboard — strategic org-wide board. */
export interface CeoPriority {
  id: string;
  title: string;
  area: string;
  dueLabel: string;
  status: string;
}

export interface CeoDashboardData {
  revenue: { annualized: number | null; growthPct: number | null };
  headcount: { value: number; delta: number };
  projects: { value: number; dueSoon: number };
  decisions: { value: number; urgent: number };
  priorities: CeoPriority[];
  snapshot: { dept: string; pct: number }[];
}

export interface PriorityRow extends CeoPriority {
  description: string;
  due: string | null;
  overdue: boolean;
}

export interface DashboardPayload {
  scope: { type: "org" | "dept" | "team"; name: string; label: string; memberCount: number; todayRate: number | null; todayCounts: { present: number; late: number; absent: number; onLeave: number; total: number } };
  kpis: Kpi[];
  charts: Record<string, ChartPoint[]>;
  deptPerf: { dept: string; headcount: number; attendance: number | null; score: number | null; openPositions: number; status: string }[];
  teamToday: { id: string; name: string; initials: string; color: string; jobTitle: string; status: string; score: number | null; tasksOpen: number; currentTask: string }[];
  approvals: { total: number; items: { id: string; kind: string; description: string; employee: string; initials: string; color: string; submitted: string }[] };
  alerts: { id: string; tone: "danger" | "warning" | "info"; title: string; body: string }[];
  onLeaveToday: Person[];
  /** Team-lead (manager) dashboard sections — present only for manager scope. */
  manager?: ManagerDashboardData | null;
  /** CEO ("MD / Executive") dashboard block — present only for the CEO role. */
  ceo?: CeoDashboardData | null;
}

/* ---------- CEO / Company Admin org-home (Figma "CEO" + "Company_Admin" boards) ---------- */

export interface OrgHomeData {
  greeting: string;
  dateLine: string;
  intro: string;
  kpis: { id: string; label: string; value: string; delta: { text: string; tone: "up" | "down" | "warn" } | null }[];
  activity: { label: string; value: number }[];
  departments: { name: string; people: number }[];
  approvals: {
    total: number;
    leaves: number;
    items: { id: string; kind: string; summary: string; status: string; employee: string; initials: string; color: string; submitted: string }[];
  };
  deadlines: { id: string; title: string; due: string; dueTs: string | null }[];
  openPositions: number;
}

export interface PersonDocRow {
  id: string;
  title: string;
  fileName: string;
  category: string;
  uploadedLabel: string;
  uploadedBy: string;
}

export interface PersonTimeLogRow {
  id: string;
  date: string;
  project: string;
  task: string;
  hours: number;
}

export interface PersonLeaveRow {
  id: string;
  kind: string;
  from: string;
  to: string;
  days: number;
  status: string;
  note: string;
}

export interface DeptRow {
  id: string;
  name: string;
  description: string;
  manager: string;
  headcount: number;
  attendance: number | null;
  score: number | null;
  openPositions: number;
  pendingApprovals: number;
  status: string;
}

export interface PeopleItem extends Person {
  status: string;
  today: string;
  score: number | null;
  openTasks: number;
  employmentType?: string;
  managerName?: string;
}

export interface PersonDetail {
  profile: Person & { managerName: string; managerJobTitle: string };
  metrics: {
    attendanceMonth: { rate: number | null; present: number; late: number; absent: number };
    perfLatest: { period: string; score: number; rating: string; status: string; reviewDate: string | null; feedback: string; goals: string[]; reviewer: string } | null;
    reviews: { id: string; period: string; score: number; rating: string; status: string; reviewDate: string | null; reviewer: string }[];
    leaveUsedMonth: number;
    leaveDaysUsed: number;
    leaveBalance: number;
    openTasks: number;
    completedTasks: number;
  };
  tasks: { id: string; title: string; status: string; priority: string; dueDate: string | null; project: string }[];
  history: { id: string; date: string; status: string; clockIn: string | null; clockOut: string | null; hours: number }[];
  projects?: { id: string; name: string; status: string; progress: number }[];
  docCount?: number;
  employmentType?: string;
}

export interface LeaveRow {
  id: string;
  type: string;
  kind: string;
  title: string;
  description: string;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  startLabel: string;
  endLabel: string;
  days: number | null;
  status: string;
  statusLabel: string;
  requester: Person | null;
  reviewer: string;
  note: string;
  submittedLabel: string;
}

export interface PerfReviewItem {
  id: string;
  period: string;
  periodLabel: string;
  person: Person;
  score: number | null;
  rating: string;
  status: string;
  reviewDate: string | null;
  reviewer: string;
  goals: string[];
  feedback: string;
}

export interface TeamTask {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  priorityKey: string;
  project: string;
  dueDate: string | null;
  due: string;
  assignee: Person | null;
}

export interface ReportData {
  report: { type: string; title: string; subtitle: string; generatedAt: string; columns: string[]; rows: string[][]; rowCount: number };
}

export interface CalendarDay {
  date: string;
  label: string;
  items: { date: string; type: string; title: string; meta: string }[];
}

/* ---------- HR portal / department-head shared shapes ---------- */

export interface PortalEvent {
  id: string;
  kind: "Birthday" | "Work Aniv.";
  label: string;
  when: string;
  person: Person;
}

export interface PortalApproval {
  id: string;
  person: Person | null;
  dept: string;
  kind: string;
  detail: string;
  waiting: number;
  waitingLabel: string;
  urgent: boolean;
}

export interface PortalDashboardData {
  scope: { type: string; name: string };
  greetingName: string;
  kpis: { headcount: number; newHires: number; pendingApprovals: number; onLeave: number; openPositions: number; openTasks: number };
  approvals: PortalApproval[];
  attendance: { present: number; onLeave: number; late: number; absent: number; rate: number | null };
  events: PortalEvent[];
  announcement: { id: string; title: string; content: string; author: string; when: string } | null;
  activity: { id: string; initials: string; color: string; name: string; text: string; when: string }[];
  onboardingCount: number;
  offboardingCount: number;
  openPositionsNote: string;
}

export interface LifecycleRow {
  id: string;
  person: Person | null;
  jobTitle: string;
  dept: string;
  startDate?: string;
  startLabel?: string;
  lastWorkingDay?: string;
  lastDayLabel?: string;
  reason?: string;
  progress: { done: number; total: number };
  progressLabel: string;
  status: string;
  statusLabel?: string;
  steps: { label: string; done: boolean }[];
}

export interface PortalDocsData {
  summary: { employees: number; filed: number };
  categories: { id: string; label: string; count: number; coverage: number }[];
  recent: { id: string; person: Person; doc: string; when: string }[];
}

/* ---------- endpoint calls ---------- */

export const hrApi = {
  dashboard: () => apiGet<{ dashboard: DashboardPayload }>("/hr/dashboard").then((d) => d.dashboard),

  departments: () => apiGet<{ departments: DeptRow[] }>("/hr/departments").then((d) => d.departments),

  myDepartment: () => apiGet<{ department: { id: string; name: string; description: string; goals: string[]; head: { name: string; jobTitle: string; email: string } | null; stats: Record<string, number | null>; people: (Person & { managerName: string; score: number | null; onLeave: boolean })[]; recentActivity: { id: string; type: string; text: string; meta: string; status?: string }[] } }>("/hr/department").then((d) => d.department),
  patchMyDepartment: (body: { goals?: string[]; description?: string }) => apiPatch<{ department: { id: string; goals: string[]; description: string } }>("/hr/department", body).then((d) => d.department),

  people: (params?: Record<string, string>) =>
    apiGet<{ scope: { type: string; name: string; memberCount: number }; items: PeopleItem[]; total: number; pagination: { page: number; total: number; pages: number }; filters: { departments: { id: string; name: string }[]; designations: string[] } }>(`/hr/people${qs(params)}`),
  person: (id: string) => apiGet<PersonDetail>(`/hr/people/${id}`),
  personDocuments: (id: string) => apiGet<{ documents: PersonDocRow[] }>(`/hr/people/${id}/documents`).then((d) => d.documents),
  uploadPersonDocument: (id: string, body: { title: string; fileName?: string; category?: string }) =>
    apiPost<{ document: PersonDocRow }>(`/hr/people/${id}/documents`, body).then((d) => d.document),
  deletePersonDocument: (id: string, docId: string) => apiDelete<null>(`/hr/people/${id}/documents/${docId}`),
  personTimeLogs: (id: string) => apiGet<{ logs: PersonTimeLogRow[] }>(`/hr/people/${id}/time-logs`).then((d) => d.logs),
  personLeaveHistory: (id: string) => apiGet<{ items: PersonLeaveRow[] }>(`/hr/people/${id}/leave-history`).then((d) => d.items),

  orgHome: () => apiGet<{ home: OrgHomeData }>("/hr/org-home").then((d) => d.home),

  attendanceToday: () => apiGet<{ date: string; scope: { type: string; name: string }; counts: { present: number; late: number; absent: number; leave: number }; rate: number | null; rows: (Person & { employeeId: string; status: string; statusLabel: string; checkIn: string; hours: string })[] }>("/hr/attendance/today"),
  attendanceSummary: (months = 6) => apiGet<{ monthly: { key: string; label: string; rate: number | null; present: number; late: number; absent: number; leave: number }[] }>(`/hr/attendance/summary?months=${months}`),
  attendanceTrend: (weeks = 8) => apiGet<{ points: ChartPoint[] }>(`/hr/attendance/trend?weeks=${weeks}`),
  attendanceList: (params?: Record<string, string>) => apiGet<{ items: (Person & { date: string; dateLabel: string; departmentName: string; status: string; statusLabel: string; clockIn: string; clockOut: string; hours: string })[]; total: number }>(`/hr/attendance${qs(params)}`),
  attendanceHistory: (id: string, days = 45) => apiGet<{ monthly: { key: string; label: string; rate: number | null; present: number; late: number; absent: number }[]; lastMonthRate: number | null; items: { id: string; date: string; dateLabel: string; status: string; statusLabel: string; clockIn: string; clockOut: string; hours: string }[] }>(`/hr/attendance/${id}?days=${days}`),

  leaves: (params?: Record<string, string>) =>
    apiGet<{ scope: { type: string; name: string }; summary: { pending: number; daysThisMonth: number; onLeaveNow: number; total: number }; items: LeaveRow[] }>(`/hr/leaves${qs(params)}`),

  decideRequest: (id: string, action: "approve" | "reject", note = "") => apiPost<{ request: unknown }>(`/requests/${id}/${action}`, { note }),

  performance: (params?: Record<string, string>) =>
    apiGet<{ scope: { type: string; name: string }; overview: { avg: number | null; distribution: ChartPoint[]; trend: { period: string; avg: number }[] }; items: PerfReviewItem[] }>(`/hr/performance${qs(params)}`),
  updatePerformance: (id: string, body: Record<string, unknown>) => apiPatch<{ review: PerfReviewItem }>(`/hr/performance/${id}`, body).then((d) => d.review),

  payroll: (month?: string) => apiGet<{ months: { key: string; label: string; net: number }[]; month: string; summary: { label: string; employees: number; net: number; base: number; allowances: number; deductions: number; vsPrev: number | null }; items: (Person & { base: string; allowances: string; deductions: string; net: string; status: string })[] }>(`/hr/payroll${qs({ month })}`),

  recruitment: () =>
    apiGet<{ summary: { open: number; postings: number; applicants: number; hired: number }; trend: ChartPoint[]; items: { id: string; title: string; departmentName: string; openings: number; applicants: number; hired: number; status: string; location: string; postedLabel: string }[] }>("/hr/recruitment"),

  teamTasks: (params?: Record<string, string>) =>
    apiGet<{ scope: { type: string; name: string }; statusCounts: Record<string, number>; open: number; items: TeamTask[] }>(`/hr/team-tasks${qs(params)}`),
  taskStats: () => apiGet<{ statusCounts: Record<string, number>; open: number; completion: ChartPoint[]; perEmployee: (Person & { open: number; done: number })[] }>("/hr/team-tasks/stats"),
  teamActivity: () => apiGet<{ items: { id: string; type: "task" | "request" | "time"; initials: string; color: string; name: string; jobTitle: string; text: string; time: string }[]; total: number }>("/hr/team-activity"),
  createTask: (body: Record<string, unknown>) => apiPost<{ task: TeamTask }>("/hr/team-tasks", body).then((d) => d.task),
  updateTask: (id: string, body: Record<string, unknown>) => apiPatch<{ task: TeamTask }>(`/hr/team-tasks/${id}`, body).then((d) => d.task),
  deleteTask: (id: string) => apiDelete<null>(`/hr/team-tasks/${id}`),

  calendar: (month?: number, year?: number) =>
    apiGet<{ month: string; monthLabel: string; counts: { leaves: number; tasks: number }; days: CalendarDay[] }>(`/hr/calendar${qs({ month, year })}`),

  reports: (params: Record<string, string>) => apiGet<ReportData>(`/hr/reports${qs(params)}`),

  priorities: () => apiGet<{ priorities: PriorityRow[] }>("/hr/priorities").then((d) => d.priorities),

  portalDashboard: () => apiGet<{ portal: PortalDashboardData }>("/hr/portal/dashboard").then((d) => d.portal),
  onboarding: () => apiGet<{ items: LifecycleRow[]; stepsTemplate: string[] }>("/hr/portal/onboarding").then((d) => d),
  createOnboarding: (body: Record<string, unknown>) => apiPost<{ item: LifecycleRow }>("/hr/portal/onboarding", body).then((d) => d.item),
  updateOnboarding: (id: string, body: Record<string, unknown>) => apiPatch<{ item: LifecycleRow }>(`/hr/portal/onboarding/${id}`, body).then((d) => d.item),
  deleteOnboarding: (id: string) => apiDelete<null>(`/hr/portal/onboarding/${id}`),
  offboarding: () => apiGet<{ items: LifecycleRow[]; stepsTemplate: string[] }>("/hr/portal/offboarding").then((d) => d),
  createOffboarding: (body: Record<string, unknown>) => apiPost<{ item: LifecycleRow }>("/hr/portal/offboarding", body).then((d) => d.item),
  updateOffboarding: (id: string, body: Record<string, unknown>) => apiPatch<{ item: LifecycleRow }>(`/hr/portal/offboarding/${id}`, body).then((d) => d.item),
  deleteOffboarding: (id: string) => apiDelete<null>(`/hr/portal/offboarding/${id}`),
  portalDocuments: () => apiGet<PortalDocsData>("/hr/portal/documents"),
};

export const STATUS_COLORS: Record<string, string> = {
  present: "success",
  late: "warning",
  absent: "danger",
  leave: "violet",
  half_day: "warning",
  "On leave": "violet",
  Present: "success",
  Late: "warning",
  Absent: "danger",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "gray",
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  completed: "success",
  in_progress: "primary",
  review: "violet",
  todo: "gray",
  draft: "gray",
  in_review: "primary",
  open: "success",
  on_hold: "warning",
  closed: "gray",
  processing: "warning",
  paid: "success",
  active: "success",
  inactive: "gray",
};

export function scoreTone(score: number | null): "success" | "warning" | "danger" | "gray" {
  if (score == null) return "gray";
  if (score >= 80) return "success";
  if (score >= 70) return "warning";
  return "danger";
}
