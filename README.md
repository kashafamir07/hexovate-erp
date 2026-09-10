# Hexovate Company ERP

Production-style Company ERP built from the Hexovate Figma design — **React + Vite + TypeScript** frontend (Employee portal) backed by an **Express + MongoDB (Mongoose)** API with JWT auth.

## Stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | React 18, Vite, TypeScript, React Router, lucide-react (no UI framework — Figma-exact custom design system) |
| Backend  | Node.js, Express, Mongoose, MongoDB, JWT (access + refresh), bcryptjs, express-validator, CORS, helmet (security headers), express-rate-limit |
| Tests    | `node:test` + supertest against an in-memory MongoDB (`mongodb-memory-server`) |
| Dev DB   | Uses `MONGODB_URI` when set; otherwise boots an ephemeral in-process MongoDB automatically |

## Getting started

```bash
# 1. Frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api
npm run dev                 # → http://localhost:5173

# 2. Backend (separate terminal)
cd server
npm install
cp .env.example .env        # fill MONGODB_URI / JWT_SECRET (optional; defaults exist for dev)
npm run seed                # demo data (see credentials below)
npm run dev                 # → http://localhost:4000
```

If no local MongoDB is available the API falls back to **mongodb-memory-server** (ephemeral DB per process) — seed again after each restart, or point `MONGODB_URI` at a real instance (e.g. `mongodb://127.0.0.1:27017/hexovate`) for persistence.

## Demo accounts

Every demo account password is `Password123!` (configurable via `SEED_PASSWORD`).

| Role            | Email                  | Person           |
| --------------- | ---------------------- | ---------------- |
| Employee        | `jordan@hexovate.com`  | Jordan Cole (Product Designer) — the Figma persona |
| Employee        | `david@hexovate.com`   | David Kim (Backend Engineer) |
| Manager         | `mike@hexovate.com`    | Mike Chen (Engineering Manager) — 9 direct reports |
| Department Head | `alex@hexovate.com`    | Alex Rivera (Head of Marketing & Sales) — Marketing scope |
| Department Head | `nina@hexovate.com`    | Nina Patel (Head of Design) |
| Executive       | `sofia@hexovate.com`   | Sofia Reyes (Chief Operating Officer) — org-wide analytics |
| HR              | `sana@hexovate.com`    | Sana Khalid (HR Manager) |
| CEO             | `priya@hexovate.com`   | Priya Nair (Chief Executive Officer) — strategic oversight |
| Company Admin   | `ravi@hexovate.com`    | Ravi Mehta (Company Administrator) — user/role administration |
| Super Admin     | `nadia@hexovate.com`   | Nadia Haddad (Super Administrator) — platform/tenant administration |

The login page has one-click demo chips that fill the email/password.

## Environment variables

| Variable        | Where              | Default                  | Purpose |
| --------------- | ------------------ | ------------------------ | ------- |
| `VITE_API_URL`  | root `.env`        | `http://localhost:4000/api` | Base URL the frontend API layer calls |
| `MONGODB_URI`   | `server/.env`      | *(empty → in-memory MongoDB)* | MongoDB connection string |
| `JWT_SECRET`    | `server/.env`      | dev-only fallback        | Signs access/refresh tokens — **set in production** |
| `PORT`          | `server/.env`      | `4000`                   | API port |
| `CLIENT_URL`    | `server/.env`      | `http://localhost:5173`  | CORS allow-list (comma-separated) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `server/.env` | `1d` / `7d` | Token lifetimes |
| `SEED_PASSWORD` | seed command env   | `Password123!`           | Password hashed for every demo account |
| `RATE_LIMIT_ENABLED` | `server/.env` | `true` | Master switch for rate limiting (set `false` only in dev/demo) |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW_MIN` | `server/.env` | `30` / `15` | Max auth-route requests per IP per window (login/register/reset) |
| `RATE_LIMIT_API_MAX` / `RATE_LIMIT_API_WINDOW_MIN` | `server/.env` | `600` / `15` | Max `/api` requests per IP per window |

No real secrets are committed. `.env.example` files exist at the repo root and in `server/`.

## Role experiences

The same app renders **seven role experiences**; routing and the API both enforce role boundaries (a wrong-role URL redirects, and a wrong-role API call returns 403):

| Role | Sign-in lands on | Pages |
| --- | --- | --- |
| employee / hr | `/dashboard` (classic Employee portal — Figma-approved) | Dashboard, Personal Workspace, Org Chart, Projects, My Tasks, Time Tracker, Messages, Announcements, My Requests |
| manager | `/manager/dashboard` | Dashboard, My Team, Attendance, Leave Requests, Performance, Tasks, Approvals, Team Calendar, Reports — **scoped to their direct reports only** |
| department_head | `/dh/dashboard` | Dashboard, My Department, Employees, Attendance, Leave Management, Performance, Tasks, Approvals, Reports — **scoped to their own department only** |
| executive | `/exec/dashboard` | Dashboard, Organization Overview, Employees, Departments, Attendance, Leave Management, Payroll Overview, Performance, Recruitment, Reports & Analytics (+ shared Announcements/Settings) |
| ceo | `/ceo/dashboard` | Figma "MD / Executive" board — Revenue, Headcount, Active Projects, Pending Decisions, Executive Priorities, Company Snapshot — plus Organization Overview, Employees, Departments, Attendance, Leave Management, Payroll, Performance, Recruitment, Reports (read-only oversight) |
| company_admin | `/ca/dashboard` | Administration Dashboard, Employees, Departments, Attendance, Leave Management, Performance, Tasks, Approvals, Reports, **User Management**, **Roles & Permissions** |
| super_admin | `/sa/dashboard` | **Platform Dashboard**, Companies, Subscriptions & Billing, Audit Logs, Support & Tickets, System Health, plus org-wide overview, team, departments, payroll, approvals, Announcements |

Executives see organization-level analytics only (no per-employee task controls); managers/department heads never see payroll, recruitment, or other teams' data; executives cannot call team-task endpoints. Scoping is enforced in the API via `requireRole(...)` guards **and** `scopeOf(user)` membership filters (executives = org, department heads = department members, managers = direct reports).

## Project structure

```text
src/                    # Frontend (Vite + React + TS)
  api/                  # API layer — one module per resource (swap-friendly)
  components/ui/        # Reusable primitives: Button, Badge, Card, DataTable,
                        #   Modal, Drawer, Select, Toggle, Checkbox, EmptyState…
  layout/               # AppShell, Sidebar, Topbar, popovers, ⌘K palette,
                        #   Login page, RequireAuth
  features/             # One folder per page: dashboard, tasks, time, requests,
                        #   messages, announcements, projects, org, workspace, account
  leader/               # Executive / Department Head / Manager experiences:
                        #   LeaderShell (per-role nav + mobile bottom bar), widgets
                        #   (KPI cards, charts, status badges), pages per feature
  api/                  # src/api/hr.ts — leader-scope API client
  data/                 # UI types + static constants (row data now served by the API)
  lib/                  # Providers (auth/notifications/toasts), data hooks
  styles/               # Tokens + component/page stylesheets + leader.css

server/                 # Backend (Express + Mongoose)
  src/
    config/             # env, db (URI or in-memory fallback)
    middleware/         # requireAuth, requireRole, validation, error handler
    models/             # User, Department, Project, Task, TimeEntry, Timesheet, Request,
                        #   Message, Announcement, Notification, Attendance,
                        #   PerformanceReview, PayrollRecord, JobPosting, Company,
                        #   AuditLog, SupportTicket
    controllers/        # Per resource group + dashboard, org-chart, and the /hr analytics
                        #   suite (hrOverview / hrPeople / hrAttendance / hrPerformance /
                        #   hrFinance / hrOps)
    routes/             # REST routes (mounted under /api, incl. hr.routes.js)
    services/           # analytics.service.js (shared computations) + notifications
    utils/              # JWT, response envelope, serializers, leader.js scopeOf()
  seed/seed.js          # Demo data (drop + reseed)
  tests/                # node:test + supertest suite (in-memory MongoDB)
```

## API overview

All routes under `/api`, JWT-protected via `Authorization: Bearer <token>`. Consistent envelope:

```json
{ "success": true,  "data": {},  "message": "…" }        // success
{ "success": false, "message": "…", "errors": [] }        // error
```

| Group | Endpoints |
| ----- | --------- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/refresh` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Users | `GET/POST /users` · `GET/PATCH/DELETE /users/:id` · `GET /users/:id/tasks|projects|timesheets` · `GET /users/me/*` shortcuts |
| Departments | CRUD `/departments` (+`/:id`) — admin/HR manage |
| Projects | CRUD `/projects` · `POST /projects/:id/members` · `DELETE /projects/:id/members/:userId` |
| Tasks | CRUD `/tasks` · `PATCH /tasks/:id/status|complete` |
| Time | `POST /time/start|stop` · `GET /time/current|summary` · `PATCH/DELETE /time/:id` (one active timer per user, durations computed server-side) |
| Timesheets | CRUD `/timesheets` · `POST /timesheets/:id/submit|approve|reject` |
| Requests | CRUD `/requests` · `POST /requests/:id/approve|reject` |
| Messages | `GET/POST /messages` · `GET /messages/:id` · `PATCH /messages/:id/read` · `DELETE /messages/:id` |
| Announcements | CRUD `/announcements` |
| Notifications | `GET /notifications` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` · `DELETE /notifications/:id` |
| Dashboard | `GET /dashboard` — payload pre-shaped for the existing Figma widgets |
| Org chart | `GET /org-chart` — managers + reports hierarchy |
| HR analytics (`/hr`, leader roles) | `GET /hr/dashboard` · `/hr/people(/:id)` · `/hr/attendance/today|summary|trend` · `/hr/attendance(/:id)` · `/hr/performance(/:id)` · `/hr/leaves` · `/hr/calendar` · `/hr/reports` — scoped per role; `/hr/departments` · `/hr/payroll` · `/hr/recruitment` (org-only) · `/hr/team-tasks*` (team-lead only) |
| Platform (`/platform`, super_admin only) | `GET /platform/overview|dashboard` · `GET/POST /platform/companies` · `GET/PATCH/DELETE /platform/companies/:id` · `GET/POST /platform/subscriptions` · `PATCH /platform/subscriptions/:id` · `GET /platform/audit` · `GET/POST /platform/tickets` · `PATCH /platform/tickets/:id` · `GET /platform/health` — multi-tenant companies, plans, MRR, audit trail, support tickets, service health |

Roles: `employee` · `manager` · `department_head` · `executive` · `ceo` · `company_admin` · `super_admin` · `hr` · `admin`. Guards: `requireAuth` on everything, `requireRole(...)` on management endpoints (payroll/recruitment/departments = executive-level and up; platform = `super_admin` only; user management = `company_admin`/`super_admin`/`admin`/`hr`), plus per-request `scopeOf(user)` membership filtering so department heads only see their department and managers only their direct reports. Employees can only mutate their own profile, tasks assigned to them, their own time/requests/messages/notifications — cross-user access returns 403/404. `passwordHash` is never serialized, and reset tokens are single-use with expiry.

## Security hardening

- **Security headers** — `helmet` on every response (HSTS, `X-Content-Type-Options`, frameguard, etc.).
- **Rate limiting** — `express-rate-limit`: a global per-IP budget on all `/api` routes (default 600 req/15 min) plus a stricter budget on the auth routes (default 30 req/15 min) to slow credential-stuffing. Blocked requests get `429` with the standard error envelope and `Retry-After`. Limiters are skipped automatically under `NODE_ENV=test`.
- **Strict CORS** — in production only origins listed in `CLIENT_URL` are accepted (no localhost wildcard); dev keeps the localhost convenience rule. Credentials enabled, methods/headers restricted, preflight cached.
- **Body size caps** — JSON bodies capped at 1 MB, urlencoded at 100 KB; oversized bodies return `413` (no stack traces leaked).
- **Pagination caps** — every list endpoint clamps `limit` server-side (users 100, projects 100, tasks 200, time 200, HR people/attendance 200, platform lists 100) via the shared `utils/pagination.js`, so no client can request unbounded result sets.

## Testing

```bash
cd server && npm test        # 109 endpoint tests (auth + password reset, roles, CRUD per
                             # resource, timers, timesheets workflow, 401/403 cases, leader role
                             # scoping, platform administration, security headers, body-size
                             # caps, pagination clamps, rate-limit 429s) on in-memory MongoDB
npm run build                # frontend: tsc + vite production build
```

## Figma fidelity & integration rules

- The Figma design is the source of truth; the backend **adapts to the shipped UI**, not the reverse — `/api/dashboard` and `/api/org-chart` return data pre-shaped for the existing widgets.
- Frontend pages render API data through the existing loading / empty / error components (toast + modal patterns); no visual redesign was made during integration.
