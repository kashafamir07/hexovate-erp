import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/AppProviders";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./layout/LoginPage";
import { AppShell } from "./layout/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { WorkspacePage } from "./features/workspace/WorkspacePage";
import { OrgChartPage } from "./features/org/OrgChartPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ProjectDetailPage } from "./features/projects/ProjectDetailPage";
import { ProjectBoardPage } from "./features/projects/ProjectBoardPage";
import { MyTasksPage } from "./features/tasks/MyTasksPage";
import { TimeTrackerPage } from "./features/time/TimeTrackerPage";
import { WeeklyTimesheetPage } from "./features/time/WeeklyTimesheetPage";
import { MessagesPage } from "./features/messages/MessagesPage";
import { AnnouncementsPage } from "./features/announcements/AnnouncementsPage";
import { RequestsPage } from "./features/requests/RequestsPage";
import { AccountSettingsPage } from "./features/account/AccountSettingsPage";

import { ForgotPasswordPage, ResetPasswordPage } from "./layout/AuthFlows";
import { PlatformDashboard } from "./platform/PlatformDashboard";
import { CompaniesPage, SubscriptionsPage } from "./platform/Tenants";
import { AuditPage, SupportTicketsPage, SystemHealthPage } from "./platform/Ops";
import { UserManagementPage, RolesPermissionsPage } from "./platform/Admin";
import {
  GlobalSearchPage,
  RoleTemplatesPage,
  SuperAdminsPage,
  SecurityAccessPage,
  SubscriptionPlansPage,
  AssignSubscriptionPage,
  BillingPaymentsPage,
  InvoiceDetailPage,
  SubscriptionLifecyclePage,
  UsageLimitsPage,
  PlatformActivityPage,
  IntegrationsPage,
  SaNotificationsPage,
} from "./platform/Pages";
import { OrgHomeDashboard } from "./leader/pages/OrgHomeDashboard";
import { OrgPeoplePage } from "./leader/pages/OrgPeople";

import { Building2, CalendarRange, ClipboardCheck, ClipboardList, Clock, FileBarChart, FileText, FolderKanban, Home, Megaphone, MessageSquare, Network, Settings, UserMinus, UserPlus, Users } from "lucide-react";
import { LeaderShell } from "./leader/LeaderShell";
import { roleConfigs, roleHomeOf, type LeaderKind } from "./leader/nav";import { LeaderDashboard } from "./leader/pages/Dashboard";
import { ManagerDashboard } from "./leader/pages/ManagerDashboard";
import { CeoDashboard } from "./leader/pages/CeoDashboard";
import { LeaderPeoplePage } from "./leader/pages/People";
import { LeaderAttendancePage } from "./leader/pages/Attendance";
import { LeaderLeavesPage, LeaderApprovalsPage } from "./leader/pages/Leaves";
import { LeaderPerformancePage } from "./leader/pages/Performance";
import { LeaderTasksPage } from "./leader/pages/Tasks";
import { LeaderKanbanPage } from "./leader/pages/Kanban";
import { LeaderWorkloadPage } from "./leader/pages/Workload";
import { LeaderActivityPage } from "./leader/pages/Activity";
import { LeaderCalendarPage } from "./leader/pages/Calendar";
import { LeaderReportsPage } from "./leader/pages/Reports";
import { ExecDepartmentsPage, ExecOrgOverviewPage, PayrollPage, RecruitmentPage } from "./leader/pages/Departments";
import { MyDepartmentPage } from "./leader/pages/MyDepartment";
import { PortalDashboard } from "./leader/pages/PortalDashboard";
import { PortalLifecyclePage } from "./leader/pages/Lifecycle";
import { PortalDocumentsPage, PortalReportsPage } from "./leader/pages/PortalMisc";
import { ExecCompanySettingsPage } from "./leader/pages/ExecCompanySettings";

/** HR Portal shell config — mirrors the Figma "HR Portal" nav. */
const hrConfig: import("./leader/nav").RoleConfig = {
  kind: "manager", // team-lead-grade page behaviors (can decide approvals)
  base: "/hr",
  label: "HR",
  dashTitle: "HR Portal",
  orgWide: true,
  groups: [
    {
      label: "MAIN",
      items: [{ id: "dashboard", label: "Dashboard", icon: Home, to: "/hr/dashboard" }],
    },
    {
      label: "PEOPLE",
      items: [
        { id: "employees", label: "Employees", icon: Users, to: "/hr/employees" },
        { id: "org-chart", label: "Org Chart", icon: Network, to: "/hr/org-chart" },
        { id: "departments", label: "Departments", icon: Building2, to: "/hr/departments" },
      ],
    },
    {
      label: "WORKFORCE",
      items: [
        { id: "onboarding", label: "Onboarding", icon: UserPlus, to: "/hr/onboarding" },
        { id: "offboarding", label: "Offboarding", icon: UserMinus, to: "/hr/offboarding" },
      ],
    },
    {
      label: "WORK",
      items: [
        { id: "projects", label: "Projects", icon: FolderKanban, to: "/hr/projects" },
      ],
    },
    {
      label: "TIME",
      items: [
        { id: "attendance", label: "Time Monitoring", icon: Clock, to: "/hr/attendance" },
        { id: "leave-calendar", label: "Leave Calendar", icon: CalendarRange, to: "/hr/leave-calendar" },
      ],
    },
    {
      label: "REQUESTS",
      items: [
        { id: "my-requests", label: "My Requests", icon: ClipboardList, to: "/hr/my-requests" },
        { id: "approvals", label: "Approvals Inbox", icon: ClipboardCheck, to: "/hr/approvals" },
      ],
    },
    {
      label: "COMMS",
      items: [
        { id: "messages", label: "Messages", icon: MessageSquare, to: "/hr/messages" },
        { id: "announcements", label: "Announcements", icon: Megaphone, to: "/hr/announcements" },
      ],
    },
    {
      label: "HR",
      items: [
        { id: "reports", label: "Reports", icon: FileBarChart, to: "/hr/reports" },
        { id: "documents", label: "Documents", icon: FileText, to: "/hr/documents" },
        { id: "settings", label: "HR Settings", icon: Settings, to: "/hr/settings" },
      ],
    },
  ],
  tabs: [
    { id: "home", label: "Home", icon: Home, to: "/hr/dashboard" },
    { id: "employees", label: "People", icon: Users, to: "/hr/employees" },
    { id: "approvals", label: "Approvals", icon: ClipboardCheck, to: "/hr/approvals" },
    { id: "reports", label: "Reports", icon: FileBarChart, to: "/hr/reports" },
    { id: "settings", label: "Account", icon: Settings, to: "/hr/settings" },
  ],
  home: "/hr/dashboard",
  peoplePath: "/hr/employees",
  settingsTo: "/hr/settings",
  canDecide: true,
  canEditPerformance: true,
};

function HrGate() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "hr") return <Navigate to={roleHomeOf(user.role)} replace />;
  return <Outlet context={hrConfig} />;
}

function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="Loading workspace">
      <span className="wordmark">HEXOVATE</span>
      <span className="boot-note">Loading your workspace…</span>
    </div>
  );
}

const LEGACY_ROLES = ["employee", "admin"];

/** Employees/HR/admins get the classic app shell; leaders are redirected to their dashboard. */
function LegacyGate() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!LEGACY_ROLES.includes(user.role)) return <Navigate to={roleHomeOf(user.role)} replace />;
  return <Outlet />;
}

function LeaderGate({ kind }: { kind: LeaderKind }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== kind) return <Navigate to={roleHomeOf(user.role)} replace />;
  return <Outlet context={roleConfigs[kind]} />;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHomeOf(user.role)} replace />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <BootSplash />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ---------- Employee / HR / Admin (unchanged experience) ---------- */}
      <Route
        element={
          <RequireAuth>
            <LegacyGate />
          </RequireAuth>
        }
      >
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/board" element={<ProjectBoardPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="time-tracker" element={<TimeTrackerPage />} />
          <Route path="time-tracker/timesheet" element={<WeeklyTimesheetPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="my-requests" element={<RequestsPage />} />
          <Route path="account" element={<AccountSettingsPage />} />
        </Route>
      </Route>

      {/* ---------- Executive ---------- */}
      <Route
        path="/exec/*"
        element={
          <RequireAuth>
            <LeaderGate kind="executive" />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={roleConfigs.executive} />}>
          <Route path="dashboard" element={<CeoDashboard cfg={roleConfigs.executive} />} />
          <Route path="organization" element={<ExecOrgOverviewPage cfg={roleConfigs.executive} />} />
          <Route path="employees" element={<LeaderPeoplePage cfg={roleConfigs.executive} />} />
          <Route path="departments" element={<ExecDepartmentsPage cfg={roleConfigs.executive} />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="time" element={<TimeTrackerPage />} />
          <Route path="time-logs" element={<WorkspacePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="my-requests" element={<RequestsPage />} />
          <Route path="approvals" element={<LeaderApprovalsPage cfg={roleConfigs.executive} />} />
          <Route path="attendance" element={<LeaderAttendancePage cfg={roleConfigs.executive} />} />
          <Route path="leaves" element={<LeaderLeavesPage cfg={roleConfigs.executive} />} />
          <Route path="payroll" element={<PayrollPage cfg={roleConfigs.executive} />} />
          <Route path="performance" element={<LeaderPerformancePage cfg={roleConfigs.executive} />} />
          <Route path="recruitment" element={<RecruitmentPage cfg={roleConfigs.executive} />} />
          <Route path="reports" element={<LeaderReportsPage cfg={roleConfigs.executive} />} />
          <Route path="documents" element={<PortalDocumentsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="company-settings" element={<ExecCompanySettingsPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/exec/dashboard" replace />} />
        </Route>
      </Route>

      {/* ---------- HR Portal (role: hr) ---------- */}
      <Route
        path="/hr/*"
        element={
          <RequireAuth>
            <HrGate />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={hrConfig} />}>
          <Route path="dashboard" element={<PortalDashboard variant="hr" />} />
          <Route path="employees" element={<LeaderPeoplePage cfg={hrConfig} />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<ExecDepartmentsPage cfg={hrConfig} />} />
          <Route path="onboarding" element={<PortalLifecyclePage kind="onboarding" />} />
          <Route path="offboarding" element={<PortalLifecyclePage kind="offboarding" />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="attendance" element={<LeaderAttendancePage cfg={hrConfig} />} />
          <Route path="leave-calendar" element={<LeaderCalendarPage cfg={hrConfig} />} />
          <Route path="my-requests" element={<RequestsPage />} />
          <Route path="approvals" element={<LeaderApprovalsPage cfg={hrConfig} />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="reports" element={<PortalReportsPage />} />
          <Route path="documents" element={<PortalDocumentsPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/hr/dashboard" replace />} />
        </Route>
      </Route>

      {/* ---------- Department Head (role removed) — legacy links land on their home ---------- */}
      <Route path="/dh/*" element={<Navigate to="/" replace />} />

      {/* ---------- Manager ---------- */}
      <Route
        path="/manager/*"
        element={
          <RequireAuth>
            <LeaderGate kind="manager" />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={roleConfigs.manager} />}>
          <Route path="dashboard" element={<ManagerDashboard cfg={roleConfigs.manager} />} />
          <Route path="team" element={<LeaderPeoplePage cfg={roleConfigs.manager} />} />
          <Route path="structure" element={<OrgChartPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tasks" element={<LeaderTasksPage cfg={roleConfigs.manager} />} />
          <Route path="kanban" element={<LeaderKanbanPage cfg={roleConfigs.manager} />} />
          <Route path="time" element={<TimeTrackerPage />} />
          <Route path="attendance" element={<LeaderAttendancePage cfg={roleConfigs.manager} />} />
          <Route path="calendar" element={<LeaderCalendarPage cfg={roleConfigs.manager} />} />
          <Route path="workload" element={<LeaderWorkloadPage cfg={roleConfigs.manager} />} />
          <Route path="monitoring" element={<LeaderActivityPage cfg={roleConfigs.manager} />} />
          <Route path="leaves" element={<LeaderLeavesPage cfg={roleConfigs.manager} />} />
          <Route path="approvals" element={<LeaderApprovalsPage cfg={roleConfigs.manager} />} />
          <Route path="performance" element={<LeaderPerformancePage cfg={roleConfigs.manager} />} />
          <Route path="reports" element={<LeaderReportsPage cfg={roleConfigs.manager} />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
        </Route>
      </Route>

      {/* ---------- CEO ---------- */}
      <Route
        path="/ceo/*"
        element={
          <RequireAuth>
            <LeaderGate kind="ceo" />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={roleConfigs.ceo} />}>
          <Route path="dashboard" element={<OrgHomeDashboard cfg={roleConfigs.ceo} />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="employees" element={<OrgPeoplePage cfg={roleConfigs.ceo} />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<ExecDepartmentsPage cfg={roleConfigs.ceo} />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/board" element={<ProjectBoardPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="time-tracker" element={<TimeTrackerPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="my-requests" element={<RequestsPage />} />
          <Route path="approvals" element={<LeaderApprovalsPage cfg={roleConfigs.ceo} />} />
          <Route path="roles" element={<RolesPermissionsPage />} />
          <Route path="*" element={<Navigate to="/ceo/dashboard" replace />} />
        </Route>
      </Route>

      {/* ---------- Company Admin ---------- */}
      <Route
        path="/ca/*"
        element={
          <RequireAuth>
            <LeaderGate kind="company_admin" />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={roleConfigs.company_admin} />}>
          <Route path="dashboard" element={<OrgHomeDashboard cfg={roleConfigs.company_admin} />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="employees" element={<OrgPeoplePage cfg={roleConfigs.company_admin} canManage />} />
          <Route path="org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<ExecDepartmentsPage cfg={roleConfigs.company_admin} />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/board" element={<ProjectBoardPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="time-tracker" element={<TimeTrackerPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="my-requests" element={<RequestsPage />} />
          <Route path="approvals" element={<LeaderApprovalsPage cfg={roleConfigs.company_admin} />} />
          <Route path="roles" element={<RolesPermissionsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="company-settings" element={<ExecCompanySettingsPage />} />
          <Route path="*" element={<Navigate to="/ca/dashboard" replace />} />
        </Route>
      </Route>

      {/* ---------- Super Admin ---------- */}
      <Route
        path="/sa/*"
        element={
          <RequireAuth>
            <LeaderGate kind="super_admin" />
          </RequireAuth>
        }
      >
        <Route element={<LeaderShell cfg={roleConfigs.super_admin} />}>
          <Route path="dashboard" element={<PlatformDashboard />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="search" element={<GlobalSearchPage />} />
          <Route path="organization" element={<ExecOrgOverviewPage cfg={roleConfigs.super_admin} />} />
          <Route path="employees" element={<LeaderPeoplePage cfg={roleConfigs.super_admin} />} />
          <Route path="roles" element={<RolesPermissionsPage />} />
          <Route path="role-templates" element={<RoleTemplatesPage />} />
          <Route path="super-admins" element={<SuperAdminsPage />} />
          <Route path="security" element={<SecurityAccessPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="plans" element={<SubscriptionPlansPage />} />
          <Route path="assign" element={<AssignSubscriptionPage />} />
          <Route path="billing" element={<BillingPaymentsPage />} />
          <Route path="invoices" element={<InvoiceDetailPage />} />
          <Route path="lifecycle" element={<SubscriptionLifecyclePage />} />
          <Route path="usage" element={<UsageLimitsPage />} />
          <Route path="platform-activity" element={<PlatformActivityPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="support" element={<SupportTicketsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="system" element={<SystemHealthPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="profile" element={<AccountSettingsPage />} />
          <Route path="notifications" element={<SaNotificationsPage />} />
          <Route path="*" element={<Navigate to="/sa/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
