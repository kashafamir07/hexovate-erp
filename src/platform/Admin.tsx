import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { ROLE_LABEL, ROLES, manageUsersApi, type MgmtUser } from "../api/users";
import { hrApi, type DeptRow } from "../api/hr";
import { LoadingBlock, ErrorBlock } from "../components/ui/Async";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { PageHead, SectionCard } from "../leader/widgets";
import { useAuth, useToasts } from "../lib/AppProviders";
import type { BadgeTone } from "../types";

const ROLE_TONE: Record<string, BadgeTone> = {
  employee: "gray",
  manager: "warning",
  department_head: "violet",
  hr: "violet",
  executive: "primary",
  admin: "primary",
  ceo: "primary",
  company_admin: "primary",
  super_admin: "danger",
};

function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] || "gray"}>{ROLE_LABEL[role] || role}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === "active" ? "success" : status === "invited" ? "warning" : "gray";
  return <Badge tone={tone}>{status}</Badge>;
}

const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

function UserForm({ initial, depts, onDone, onCancel }: { initial: Partial<MgmtUser> | null; depts: DeptRow[]; onDone: () => void; onCancel: () => void }) {
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    email: initial?.email || "",
    password: "",
    phone: initial?.phone || "",
    jobTitle: initial?.jobTitle || "",
    employeeId: initial?.employeeId || "",
    department: initial?.departmentId || initial?.department?._id || "",
    role: initial?.role || "employee",
    status: initial?.status || "active",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        jobTitle: form.jobTitle,
        employeeId: form.employeeId,
        department: form.department || null,
        role: form.role,
        status: form.status,
      };
      if (!initial) payload.password = form.password || "Welcome123!";
      if (initial) await manageUsersApi.update(initial.id!, payload);
      else await manageUsersApi.create(payload);
      push(initial ? "User updated" : "User created", "success");
      onDone();
    } catch (err) {
      push(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="modal-body form-stack">
      <div style={grid2}>
        <div className="field">
          <label htmlFor="u-first">First name *</label>
          <input id="u-first" className="field-input" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="u-last">Last name *</label>
          <input id="u-last" className="field-input" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label htmlFor="u-email">Email *</label>
          <input id="u-email" type="email" className="field-input" required value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!!initial} />
        </div>
        {!initial ? (
          <div className="field">
            <label htmlFor="u-pass">Password</label>
            <input id="u-pass" type="password" className="field-input" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Welcome123! (default)" autoComplete="new-password" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="u-eid">Employee ID</label>
            <input id="u-eid" className="field-input" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} />
          </div>
        )}
      </div>
      <div style={grid2}>
        <div className="field">
          <label htmlFor="u-job">Job title</label>
          <input id="u-job" className="field-input" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Product Designer" />
        </div>
        <div className="field">
          <label htmlFor="u-phone">Phone</label>
          <input id="u-phone" className="field-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label>Department</label>
          <Select ariaLabel="Department" value={form.department} onChange={(v) => set("department", v)} size="md" options={[{ value: "", label: "No department" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} />
        </div>
        {initial ? (
          <div className="field">
            <label htmlFor="u-eid2">Employee ID</label>
            <input id="u-eid2" className="field-input" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} />
          </div>
        ) : null}
      </div>
      <div style={grid2}>
        <div className="field">
          <label>Role</label>
          <Select ariaLabel="Role" value={form.role} onChange={(v) => set("role", v)} size="md" options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </div>
        <div className="field">
          <label>Status</label>
          <Select ariaLabel="Status" value={form.status} onChange={(v) => set("status", v)} size="md" options={[{ value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "inactive", label: "Inactive" }]} />
        </div>
      </div>
      <div className="modal-foot">
        <Button variant="ghost" size="md" onClick={onCancel} type="button">Cancel</Button>
        <Button variant="primary" size="md" type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Create user"}</Button>
      </div>
    </form>
  );
}

export function UserManagementPage() {
  const { user } = useAuth();
  const { push } = useToasts();
  const [data, setData] = useState<Awaited<ReturnType<typeof manageUsersApi.list>> | null>(null);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MgmtUser | null>(null);
  const [removing, setRemoving] = useState<MgmtUser | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, deptRows] = await Promise.all([manageUsersApi.list({ search, role, status, page, limit: 20, sort: "firstName" }), hrApi.departments()]);
      setData(list);
      setDepts(deptRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, [search, role, status, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!removing) return;
    try {
      await manageUsersApi.remove(removing.id);
      push("User removed", "success");
      setRemoving(null);
      void load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  return (
    <section className="page">
      <PageHead
        title="User Management"
        subtitle="Accounts, roles, departments and employment status across the company."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> Add user
          </Button>
        }
      />

      <SectionCard title="All users" action={<span className="ldr-count">{data?.pagination.total ?? "…"} accounts</span>}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="field-input" style={{ maxWidth: 260 }} placeholder="Search name, email, title…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select ariaLabel="Filter by role" value={role} onChange={(v) => { setRole(v); setPage(1); }} options={[{ value: "", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
          <Select ariaLabel="Filter by status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "inactive", label: "Inactive" }]} />
        </div>
        {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
        {!data && !error ? <LoadingBlock rows={8} /> : null}
        {data && data.items.length === 0 ? <EmptyState icon={Users} title="No users match" body="Adjust the filters or add a new user." /> : null}
        {data && data.items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Job title</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u, i) => (
                  <tr key={u.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td>
                      <span className="person-cell">
                        <Avatar initials={u.initials} color={u.color} title={u.name} />
                        <span>
                          <strong>{u.name}</strong>
                          <br />
                          <span className="cell-muted">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td><span className="cell-muted">{u.employeeId || "—"}</span></td>
                    <td><span className="cell-muted">{u.departmentName || u.department?.name || "—"}</span></td>
                    <td><span className="cell-muted">{u.jobTitle || "—"}</span></td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="icon-btn-flat" aria-label={`Edit ${u.name}`} onClick={() => setEditing(u)}>
                          <Pencil aria-hidden="true" style={{ width: 14, height: 14 }} />
                        </button>
                        <button type="button" className="icon-btn-flat" aria-label={`Remove ${u.name}`} disabled={u.email === user?.email} onClick={() => setRemoving(u)} title={u.email === user?.email ? "You cannot remove your own account" : "Remove user"}>
                          <Trash2 aria-hidden="true" style={{ width: 14, height: 14, color: u.email === user?.email ? "#cbd5e1" : "#dc2626" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && data.pagination.pages > 1 ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, alignItems: "center" }}>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="cell-muted">Page {page} of {data.pagination.pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}
      </SectionCard>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add user" width={620}>
        <UserForm initial={null} depts={depts} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} width={620}>
        {editing ? <UserForm initial={editing} depts={depts} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void load(); }} /> : null}
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove user" width={420}>
        <div className="modal-body">
          <p>Remove <strong>{removing?.name}</strong> ({removing?.email}) permanently? Consider setting their status to <em>Inactive</em> instead if they may return.</p>
          <div className="modal-foot">
            <Button variant="ghost" size="md" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => void remove()}>Remove user</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* --------------------------------- Roles & permissions --------------------------------- */

type Access = "platform" | "manage" | "decide" | "view" | "own" | "team" | "dept" | "none";

interface MatrixRow {
  feature: string;
  /** column order: employee, manager, department_head, hr, executive, admin, ceo, company_admin, super_admin */
  cells: Access[];
  note?: string;
}

const COLUMNS = ["Employee", "Manager", "Dept. Head", "HR", "Executive", "Admin", "CEO", "Company Admin", "Super Admin"];

/** Mirrors the authorization rules enforced in server/src (requireRole lists + scope helpers). */
const MATRIX: MatrixRow[] = [
  { feature: "Personal dashboard & workspace", cells: ["own", "team", "dept", "manage", "view", "manage", "view", "manage", "platform"] },
  { feature: "Company directory (employees)", cells: ["own", "team", "dept", "manage", "view", "manage", "view", "manage", "manage"], note: "Employees see only themselves; managers see direct reports; dept heads their department." },
  { feature: "Departments", cells: ["none", "none", "dept", "manage", "view", "manage", "view", "manage", "manage"] },
  { feature: "Attendance & leave records", cells: ["none", "team", "dept", "manage", "view", "view", "view", "manage", "manage"], note: "Attendance & leave analytics are org-wide for executives/CEOs (read-only)." },
  { feature: "Leave & request approvals", cells: ["own", "decide", "decide", "manage", "view", "decide", "view", "decide", "decide"], note: "Employees create & track their own requests." },
  { feature: "Performance reviews", cells: ["own", "team", "dept", "manage", "view", "manage", "view", "manage", "manage"], note: "Managers & dept heads can write reviews for their people." },
  { feature: "Payroll overview", cells: ["none", "none", "none", "manage", "view", "manage", "view", "manage", "manage"] },
  { feature: "Recruitment", cells: ["none", "none", "none", "manage", "view", "manage", "view", "manage", "manage"] },
  { feature: "Team tasks & task assignment", cells: ["own", "manage", "manage", "none", "none", "none", "none", "manage", "manage"] },
  { feature: "User management (create / roles / status)", cells: ["none", "none", "none", "manage", "none", "manage", "none", "manage", "manage"], note: "Server-enforced on POST/PATCH/DELETE /api/users." },
  { feature: "Platform administration (companies, billing, audit, support)", cells: ["none", "none", "none", "none", "none", "none", "none", "none", "platform"], note: "Only super_admin may call /api/platform/*." },
  { feature: "Publish announcements", cells: ["none", "none", "none", "manage", "none", "manage", "none", "manage", "manage"] },
];

const ACCESS_LABEL: Record<Access, string> = {
  platform: "Platform",
  manage: "Manage",
  decide: "Decide",
  view: "View",
  own: "Self",
  team: "Team",
  dept: "Dept",
  none: "—",
};

export function RolesPermissionsPage() {
  return (
    <section className="page">
      <PageHead title="Roles & Permissions" subtitle="What each role can see and do across the ERP — enforced on both the UI routes and the backend API." />

      <SectionCard title="Capability matrix" action={<span className="ldr-count">{COLUMNS.length} roles</span>}>
        <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
          This matrix mirrors the authorization rules enforced in the server (<code>requireRole</code> gates and scope helpers): a role can never act on data outside its scope, even by calling the API directly.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Capability</th>
                {COLUMNS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 1 ? "striped" : ""}>
                  <td>
                    <strong className="cell-strong">{row.feature}</strong>
                    {row.note ? (
                      <br />
                    ) : null}
                    {row.note ? <span className="cell-muted">{row.note}</span> : null}
                  </td>
                  {row.cells.map((acc, j) => (
                    <td key={j}>
                      {acc === "none" ? <span className="cell-muted">—</span> : <Badge tone={accessTone(acc)}>{ACCESS_LABEL[acc]}</Badge>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          {(["platform", "manage", "decide", "view", "team", "dept", "own"] as Access[]).map((a) => (
            <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
              <Badge tone={accessTone(a)}>{ACCESS_LABEL[a]}</Badge> {a === "own" ? "own record only" : `${a} scope`}
            </span>
          ))}
        </div>
        <p className="cell-muted" style={{ fontSize: 12, marginTop: 12 }}>
          <KeyRound aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Roles are assigned by admins via User Management. Changing a user&apos;s role instantly changes their dashboards, navigation and API access — it is never read from the client.
        </p>
      </SectionCard>

      <SectionCard title="Role models at a glance">
        <div className="ldr-dept-grid">
          {[
            { icon: UserCog, role: "Company Admin", blurb: "Runs the company day-to-day: users, departments, approvals, performance, reports." },
            { icon: ShieldCheck, role: "Super Admin", blurb: "Platform owner: tenant companies, subscriptions & billing, audit logs, support, plus full company access." },
            { icon: ShieldCheck, role: "CEO / Executive", blurb: "Org-wide strategic oversight — reads company KPIs, payroll and performance; no employee-level edits." },
            { icon: UserCog, role: "HR", blurb: "People operations: org-wide directory, lifecycle, attendance, leave and payroll." },
            { icon: Users, role: "Manager", blurb: "Leads their direct reports: team tasks, approvals, attendance and performance for their team." },
          ].map((c) => (
            <section className="card ldr-section" key={c.role} style={{ minWidth: 0 }}>
              <span className="ldr-kpi-icon" style={{ display: "inline-flex" }}>
                <c.icon aria-hidden="true" />
              </span>
              <h3 style={{ margin: "10px 0 4px", fontSize: 15 }}>{c.role}</h3>
              <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>{c.blurb}</p>
            </section>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

function accessTone(a: Access): BadgeTone {
  switch (a) {
    case "platform":
      return "danger";
    case "manage":
      return "success";
    case "decide":
      return "primary";
    case "view":
      return "gray";
    case "team":
    case "dept":
    case "own":
      return "violet";
    default:
      return "gray";
  }
}
