# Hexovate Company ERP — Figma Design Analysis

> Decoded from `canvas.fig` (modern **fig-kiwi** container, version 106) exported 2026-09-03.
> Reference extracts in this folder: `role_dashboards.txt`, `screens_tree.txt`, `design_system.txt`,
> `tokens_components.txt`, plus `tools/` (scripts to decode & re-extract) and the original `canvas.fig`.

## 1. Canvas layout

Figma file `Hexovate_Company_ERP_UIUX_Design`, single page **"Page 1"** + an internal components
canvas. Page 1 is one giant artboard (render ≈ 23,990 × 54,122 px) organised into **9 top-level sections**,
which exactly match the per-role PNG exports:

| # | Section | Canvas size | App screens (Desktop + Android/Mobile) |
|---|---------|-------------|----------------------------------------|
| 1 | Authentication | 1440×6399 | Login, MFA Verification, Forgot Password (×2 each) + flow/state/handoff boards |
| 2 | Design | 1920×3158 | Design system sheet (colors, type, buttons…) + SVG icon set |
| 3 | MD / EXECUTIVE | 1440×46633 | 23 screens ×2 |
| 4 | SUPER ADMIN | 1440×49420 | 25 screens ×2 |
| 5 | Employee / General User | 1940×23692 | 20 screens ×2 |
| 6 | Company_Admin | 2165×25497 | 25 screens ×2 |
| 7 | Team Lead / Manager Role | 2233×32278 | 25 desktop + 23 mobile |
| 8 | HR / Department Head Role | 1942×36150 | 25 screens ×2 (named `s01…s25`) |
| 9 | CEO | 3046×39231 | 34 screens ×2 (named `div#01…div#34`) |

Every app screen is designed at **1280×~900 desktop** and **~390×~844 Android/mobile**, plus overlays
(modals, drawers) — ~350 screens total, all with real copy and real data. No lorem ipsum; every table,
KPI and form has concrete sample data (employees, projects, departments, requests…).

The design was authored by converting a real HTML/CSS prototype into Figma (html.to.design import):
frames named `DIV`/`ASIDE`/`NAV`/`svg-*`/`artboard`/`shell`, `textData.characters` for text, vector
icons with real paths. This means the Figma layer tree is *already* a DOM-like structure — ideal for a
1:1 React implementation.

## 2. Product shape

**Hexovate** = multi-role company ERP web app (one company view) + **multi-tenant platform admin**
(Super Admin manages tenant companies & subscriptions). One responsive app: desktop layout
(sidebar + topbar + content), mobile layout (top app bar + content + bottom tab bar).

### Role → navigation (extracted from each role's sidebar)

**Employee** (Jordan Cole, "Employee"): MAIN Dashboard · Personal Workspace · PEOPLE Org Chart ·
WORK Projects · My Tasks · Time Tracker · COMMS Messages · Announcements · REQUESTS My Requests.

**Company Admin / CEO** (Amelia Carter, "CEO"): MAIN Dashboard · Personal Workspace · PEOPLE
Employees · Org Chart · Departments · WORK Projects · My Tasks · Time Tracker · COMMS Messages ·
Announcements · REQUESTS My Requests · Approvals Inbox(6) · ADMIN Roles & Permissions · User
Management · Company Settings.

**MD / Executive** (John Doe): MAIN Dashboard · Executive Overview · ORGANIZATION Departments ·
People · Org Chart · WORK Projects · My Tasks · Time Overview · Time Logs · COMMS & REQUESTS
Messages · Announcements · My Requests · Approvals · REPORTING Reports · RESOURCES Documents ·
Leave & Attendance · ADMIN Company Settings · Profile & Preferences · Notifications.

**HR / Department Head** (Sana Khalid): Dashboard · Employees · Org Chart · Departments · WORKFORCE
Onboarding · Offboarding · WORK Projects · TIME Time Monitoring · Leave Calendar · REQUESTS My
Requests · Approvals Inbox · COMMS Messages · Announcements · HR Reports · Documents · HR Settings.

**Team Lead** (Rachel Khan): Dashboard · TEAM My Team · Team Structure · WORK Projects · Team Tasks ·
Kanban Board · TIME Attendance · Team Calendar · Workload · MONITORING Activity Monitoring ·
REQUESTS Leave Requests · Approvals · INSIGHTS Performance · Reports · COMMS Messages ·
Announcements · ACCOUNT My Profile & Settings. (Mobile uses bottom tabs: Dashboard · Team · Tasks ·
Approvals · Profile.)

**Super Admin** (platform level): PLATFORM Platform Dashboard · Companies · Global Search · TENANTS
Company Overview · Company Team · Company Roles · ACCESS Role Templates · Super Admins · Security &
Access · SUBSCRIPTIONS Subscriptions · Subscription Plans · Assign Subscription · Billing & Payments ·
Invoice Detail · Subscription Lifecycle · Usage & Limits · OPERATIONS Platform Activity · Audit Logs ·
Support & Tickets · Announcements · System Health · Integrations · ACCOUNT Super Admin Profile ·
Notifications.

### Global app chrome (shared by every role)

- **Desktop**: fixed left sidebar (`HEXOVATE` wordmark, grouped nav, active-state highlight, user
  card w/ avatar initials at bottom) + top bar (breadcrumb `Home / <Screen>`, global search box
  w/ ⌘K hint, notification bell, avatar) + content area.
- **Mobile**: top bar (logo/breadcrumb, search, bell) + content + bottom tab bar; hamburger drawer for full menu.
- **Command palette**: every role has one (⌘K / Ctrl-K).

## 3. Verified screen sets (per role, numbered like the design)

**Authentication (01–06 + docs)**: Login, MFA Verification, Forgot Password — each Desktop & Android;
plus *Required States & Command Palette*, *Time Tracker — Manual Entry Modal*, flow diagrams
(Employee Login, Create & Assign Task, Leave Request & Approval), *Design Handoff & Accessibility*,
*Kanban Board* (desktop & mobile).

**Employee (07–50, labelled in the file)**: Dashboard · Personal Workspace · Org Chart · Projects List ·
Project Detail · Kanban Board · Task Detail · My Tasks · Time Tracker · Weekly Timesheet · Manual Time
Entry · My Requests · New Leave Request · New Expense Request · Messages · Announcements ·
Notifications · Command Palette · Account Settings · Request Detail — ×Desktop/Android.

**CEO (div#01–34, full name list in file)**: Dashboard · Employees List · Employees Card Grid · Employee
Profile (Overview / Documents) · Employee Add Modal · Org Chart · Departments List · Department Detail ·
Department Add Modal · Projects List · Project Detail (Overview) · Project Board (Kanban) · Task Detail
Drawer · New Project Modal · Weekly Timesheet · Time Tracker (Company) · Approvals Inbox · Approval
Detail Modal · My Requests · Communication Hub · Announcements · Roles & Permissions · User
Management · Company Settings · Backup Overview · Backup History · Create Manual Backup Modal ·
Backup Details Drawer · Restore (Select Version / Warning / Progress / Completed) · Backup Recovery
Audit Log — ×Desktop/Android.

**HR (s01–s25)** + **MD (23)** + **Company Admin (25)** + **Team Lead (25)** + **Super Admin (25)**
screen names are in the design file (`analysis/screens_tree.txt` + `role_dashboards.txt` list each
section's dashboard content). They mirror the same ERP surfaces scoped to each role's menu above.

## 4. Design system (from the Design sheet — source of truth)

**Colors**
| Token | Value |
|---|---|
| Primary | `#1F3C88` |
| Primary Dark | `#1E3A5F` |
| Accent | `#2E86AB` |
| Mid | `#C7D2FE` |
| Light | `#EEF2FF` |
| Text | `#374151` |
| Success | `#16A34A` |
| Warning | `#B45309` |
| Danger | `#DC2626` |

**Typography** — Inter everywhere (13–24 px), JetBrains Mono for data numerals:
H1 Page title 24/Bold · H2 Section 18/Semibold · H3 Sub 15/Semibold · Body 14/Regular ·
Label 12/Medium · Data 13 JetBrains Mono. (26k+ text runs in file all use Inter; weights
Regular/Medium/Semibold/Bold.)

**Components catalogued in the sheet** — Buttons (primary/secondary/danger/ghost/link ×
small/medium/large/disabled/with-icon), Badges (Active, Pending, Overdue, In Progress, In Review,
Archived), Form inputs (default/focused/error/disabled, left-icon search, select, textarea, checkbox,
radio, toggle on/off), Cards (standard card, stat card `1,234 +12%`, empty state), Toasts (success/
error). Recurring composites across screens: sidebar nav, top bar w/ breadcrumb + ⌘K search,
KPI stat row, data tables w/ avatars + status badges + action buttons, kanban board w/ draggable
cards, modal/drawer overlays, approval request rows, avatar initials (2-letter, colored), profile
dropdown, notification list. Icons are a fixed vector SVG set (24×24, stroke style).

## 5. Backend functionality implied by the pages

- **Auth**: login (email/password), MFA code verify, forgot/reset password, session/roles.
- **People & org**: employees CRUD (+card/list/table views, profiles w/ documents), departments
  CRUD, org chart, roles & permissions, user management, onboarding/offboarding (HR), invites.
- **Work**: projects CRUD w/ overview, kanban boards, tasks (+detail drawer), task assignment,
  workload/team structure (leads), activity monitoring.
- **Time**: time tracker + manual entry, weekly timesheets, attendance (check-in, late flags),
  leave calendar + balances.
- **Requests & approvals**: leave/expense/purchase requests, approval inbox (per-role workflow),
  request detail, notifications, toasts.
- **Comms**: messages (DMs + channels, unread), announcements, global search + ⌘K command palette.
- **Platform (Super Admin)**: companies (tenants), company teams/roles, role templates, security &
  access, subscriptions/plans/billing/invoices/lifecycle/usage limits, platform activity, audit logs,
  support tickets, system health, integrations, platform announcements.
- **Backups (CEO/admin)**: manual & scheduled backup, restore wizard, backup audit log.
- **Reporting**: role-specific reports/dashboards (revenue, headcount, KPIs for MD/CEO).

## 6. Proposed architecture

**Stack**: React 18 + Vite + TypeScript, Tailwind CSS (design tokens mapped to the palette above),
React Router (role-scoped route trees), lucide-react icons (match stroke style), zustand or Context for
session/role/permissions. Mock API layer (`src/api/mock/*`) behind repository interfaces so a real
backend can be swapped in later. Per-role demo data seeded from the Figma sample data
(Amelia Carter/CEO, Jordan Cole/Employee, John Doe/MD, Sana Khalid/HR, Rachel Khan/Team Lead…).

```
src/
  app/            router, providers, guards (role-based), app shell layout
  auth/           login, mfa, forgot-password (desktop + mobile)
  layout/         AppShell: Sidebar, Topbar, MobileBottomNav, CommandPalette
  components/ui/  button, badge, input, select, textarea, checkbox, radio, toggle,
                  card, stat-card, modal, drawer, toast, avatar, table, tabs, dropdown,
                  empty-state, search, breadcrumb…
  components/     sidebar-nav, topbar, kpi-row, data-table, kanban-board, request-row,
                  notification-list, org-chart…
  features/       dashboard, employees, departments, orgchart, projects, tasks, kanban,
                  time/*, requests/*, approvals/*, messages, announcements, notifications,
                  settings, roles, users, backup/*, hr/*, platform/* (super admin)
  data/           mock api + typed fixtures (types shared w/ models)
  lib/            format, cn(), dates, auth session helpers
  assets/
```

**Implementation order** (design-first, screen-by-screen to match pixel fidelity):
1. Design tokens + Tailwind theme; app shell (sidebar/topbar/mobile nav) per role config.
2. Auth screens + session routing.
3. Shared components from the Component Library sheet.
4. One vertical slice (Employee Dashboard) end-to-end, then role modules by menu order.
5. Super Admin platform + CEO backups last.

Reference files produced by this analysis live next to this doc; decoding/extraction scripts are in
`analysis/tools/` (requires `npm i kiwi-schema fzstd fflate` then `node decode.js canvas.fig out.json`).
