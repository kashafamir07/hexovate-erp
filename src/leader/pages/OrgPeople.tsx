import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import { hrApi, type PersonDetail, type PersonDocRow, type PersonLeaveRow, type PersonTimeLogRow } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { isOrgKind, type RoleConfig } from "../nav";
import { PageHead, PersonCell, ScorePill, SectionCard, StatusBadge } from "../widgets";
import { downloadCsv } from "../util";

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};

/**
 * "Employees" page per the CEO/Company_Admin Figma: search + Department +
 * Status + Employment Type filters, card/grid toggle, pagination footer and
 * an "Add user" action for admins (CEO sees it read-only per the matrix).
 */
export function OrgPeoplePage({ cfg, canManage = false }: { cfg: RoleConfig; canManage?: boolean }) {
  const { push } = useToasts();
  const [items, setItems] = useState<import("../../api/hr").PeopleItem[] | null>(null);
  const [filters, setFilters] = useState<{ departments: { id: string; name: string }[]; designations: string[] }>({ departments: [], designations: [] });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [empType, setEmpType] = useState("");
  const [view, setView] = useState<"list" | "card">("list");
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<PersonDetail | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const orgWide = isOrgKind(cfg.kind);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = { page: String(page), limit: "12" };
      if (q) params.search = q;
      if (dept) params.department = dept;
      if (status) params.status = status;
      if (empType) params.employmentType = empType;
      const data = await hrApi.people(params);
      setItems(data.items);
      setTotal(data.total);
      setFilters((prev) => ({
        departments: prev.departments.length ? prev.departments : data.filters.departments,
        designations: prev.designations.length ? prev.designations : data.filters.designations,
      }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [q, dept, status, empType, page]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q ? 260 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const openProfile = useCallback(async (id: string) => {
    setProfileId(id);
    setProfile(null);
    try {
      setProfile(await hrApi.person(id));
    } catch (e) {
      push(errorMessage(e), "error");
    }
  }, [push]);

  const exportRows = useCallback(() => {
    if (!items) return;
    downloadCsv(
      "employees",
      ["Employee ID", "Name", "Job Title", "Department", "Employment status", "Type", "Attendance today", "Performance score"],
      items.map((p) => [p.employeeId || "", p.name, p.jobTitle || "", p.departmentName || "", p.status, EMPLOYMENT_LABEL[p.employmentType || ""] || p.employmentType || "", p.today, p.score ?? ""])
    );
    push("Employee report exported", "success");
  }, [items, push]);

  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <section className="page">
      <PageHead
        title={orgWide ? "Employees" : "My Team"}
        subtitle={`${orgWide ? "Everyone across the organization" : "Your direct reports"} — ${total} ${total === 1 ? "person" : "people"}`}
        actions={
          <Button variant="white" size="sm" onClick={exportRows} disabled={!items?.length}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export report
          </Button>
        }
      />

      <div className="ldr-toolbar">
        <span className="search-input" style={{ maxWidth: 260 }}>
          <Search aria-hidden="true" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name, email, title…" aria-label="Search employees" />
        </span>
        <Select ariaLabel="Department filter" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "", label: "Department" }, ...filters.departments.map((d) => ({ value: d.id, label: d.name }))]} />
        <Select ariaLabel="Status filter" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "invited", label: "Invited" }]} />
        <Select ariaLabel="Employment type filter" value={empType} onChange={(v) => { setEmpType(v); setPage(1); }} options={[{ value: "", label: "Employment Type" }, { value: "full_time", label: "Full-time" }, { value: "part_time", label: "Part-time" }, { value: "contract", label: "Contract" }, { value: "intern", label: "Intern" }]} />
        <span className="ldr-spacer" />
        <span className="seg-toggle" role="group" aria-label="View mode">
          <button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List view">☰</button>
          <button type="button" className={view === "card" ? "active" : ""} aria-pressed={view === "card"} onClick={() => setView("card")} aria-label="Card view">▦</button>
        </span>
      </div>

      {items === null && !error ? (
        <LoadingBlock rows={5} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={Search} title="No employees match" body="Try adjusting the filters or search term." />
      ) : view === "list" ? (
        <SectionCard>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Manager</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td><PersonCell person={p} /></td>
                    <td><span className="cell-muted">{p.jobTitle || "—"}</span></td>
                    <td><span className="cell-muted">{p.departmentName || "—"}</span></td>
                    <td><span className="cell-muted">{(p as unknown as { managerName?: string }).managerName || "—"}</span></td>
                    <td><span className="cell-muted">{p.email || "—"}</span></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button variant="white" size="sm" onClick={() => void openProfile(p.id)}>View</Button>
                        {canManage ? (
                          <Button variant="white" size="sm" onClick={() => push("Edit from User Management (Admin > User Management).")}>Edit</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="org-people-foot">
            <span className="cell-muted">Showing {items.length} of {total} employees</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Button variant="white" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="cell-muted" style={{ fontSize: 13 }}>{page} / {pages}</span>
              <Button variant="white" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="org-people-cards">
            {items.map((p) => (
              <section className="card org-person-card" key={p.id}>
                <PersonCell person={p} />
                <div className="cell-muted" style={{ fontSize: 12.5, margin: "4px 0 8px" }}>
                  {p.jobTitle || "—"}{p.departmentName ? ` · ${p.departmentName}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <StatusBadge status={p.status} />
                  <Button variant="white" size="sm" onClick={() => void openProfile(p.id)}>View</Button>
                </div>
              </section>
            ))}
          </div>
          <div className="org-people-foot">
            <span className="cell-muted">Showing {items.length} of {total} employees</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Button variant="white" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="cell-muted" style={{ fontSize: 13 }}>{page} / {pages}</span>
              <Button variant="white" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</Button>
            </div>
          </div>
        </>
      )}

      <ProfileDrawer open={Boolean(profileId)} onClose={() => setProfileId(null)} detail={profile} personId={profileId} />
    </section>
  );
}

/* ---------------- Employee profile with Figma tabs ---------------- */

type ProfileTab = "overview" | "documents" | "projects" | "time" | "leave";

export function ProfileDrawer({ open, onClose, detail, personId }: { open: boolean; onClose: () => void; detail: PersonDetail | null; personId: string | null }) {
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [docs, setDocs] = useState<PersonDocRow[] | null>(null);
  const [logs, setLogs] = useState<PersonTimeLogRow[] | null>(null);
  const [leaves, setLeaves] = useState<PersonLeaveRow[] | null>(null);

  useEffect(() => {
    setTab("overview");
    setDocs(null);
    setLogs(null);
    setLeaves(null);
  }, [personId]);

  useEffect(() => {
    if (!open || !personId) return;
    if (tab === "documents" && docs === null) {
      void hrApi.personDocuments(personId).then(setDocs).catch(() => setDocs([]));
    }
    if (tab === "time" && logs === null) {
      void hrApi.personTimeLogs(personId).then(setLogs).catch(() => setLogs([]));
    }
    if (tab === "leave" && leaves === null) {
      void hrApi.personLeaveHistory(personId).then(setLeaves).catch(() => setLeaves([]));
    }
  }, [open, personId, tab, docs, logs, leaves]);

  if (!detail) return null;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "projects", label: "Projects" },
    { id: "time", label: "Time Logs" },
    { id: "leave", label: "Leave History" },
  ];

  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={onClose}>
      <div className="drawer drawer--wide" role="dialog" aria-modal="true" aria-label={`${detail.profile.name} profile`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="avatar" style={{ background: detail.profile.color, width: 44, height: 44, fontSize: 15 }}>
              {detail.profile.initials}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 17 }}>{detail.profile.name}</h2>
              <span className="cell-muted" style={{ fontSize: 12.5 }}>
                {detail.profile.jobTitle}{detail.profile.departmentName ? ` · ${detail.profile.departmentName}` : ""}
              </span>
            </div>
          </div>
          <button type="button" className="icon-btn-flat" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="org-profile-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === "overview" ? (
            <div className="ldr-stack">
              <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", marginBottom: 0 }}>
                <MiniStat label="Attendance (month)" value={detail.metrics.attendanceMonth.rate != null ? `${detail.metrics.attendanceMonth.rate}%` : "—"} />
                <MiniStat label="Open tasks" value={String(detail.metrics.openTasks)} />
                <MiniStat label="Completed tasks" value={String(detail.metrics.completedTasks)} />
                <MiniStat label="Leave balance" value={`${detail.metrics.leaveBalance} days`} />
              </div>
              {detail.metrics.perfLatest ? (
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 13.5 }}>Latest review — {detail.metrics.perfLatest.period}</strong>
                    <ScorePill score={detail.metrics.perfLatest.score} />
                  </div>
                  {detail.metrics.perfLatest.feedback ? <p className="cell-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{detail.metrics.perfLatest.feedback}</p> : null}
                </div>
              ) : null}
              {detail.tasks.length > 0 ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr><th>Task</th><th>Project</th><th>Status</th><th>Priority</th></tr>
                    </thead>
                    <tbody>
                      {detail.tasks.slice(0, 5).map((t) => (
                        <tr key={t.id}>
                          <td>{t.title}</td>
                          <td><span className="cell-muted">{t.project || "—"}</span></td>
                          <td><StatusBadge status={t.status} /></td>
                          <td><StatusBadge status={t.priority} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "documents" ? (
            docs === null ? (
              <LoadingBlock rows={3} card={false} />
            ) : docs.length === 0 ? (
              <EmptyState icon={FileText} title="No documents" body="Contracts, IDs and reviews appear here once HR files them." />
            ) : (
              <ul className="home-dept-list">
                {docs.map((d) => (
                  <li key={d.id}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <FileText aria-hidden="true" style={{ width: 15, height: 15, color: "#2563eb" }} />
                      <span>
                        <strong className="cell-strong" style={{ display: "block", fontSize: 13.5 }}>{d.title}</strong>
                        <span className="cell-muted" style={{ fontSize: 12 }}>Uploaded {d.uploadedLabel}{d.uploadedBy ? ` · ${d.uploadedBy}` : ""}</span>
                      </span>
                    </span>
                    <span className="cell-muted" style={{ fontSize: 12 }}>{d.category}</span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "projects" ? (
            !detail.projects || detail.projects.length === 0 ? (
              <EmptyState icon={FileText} title="No projects" body="This employee isn't assigned to any projects yet." />
            ) : (
              <ul className="home-dept-list">
                {detail.projects.map((p) => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <span className="cell-muted">{p.progress}% · {p.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "time" ? (
            logs === null ? (
              <LoadingBlock rows={3} card={false} />
            ) : logs.length === 0 ? (
              <EmptyState icon={FileText} title="No time entries" body="Tracked hours will appear here." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Project</th><th>Task</th><th>Hours</th></tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>{new Date(l.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        <td><span className="cell-muted">{l.project}</span></td>
                        <td>{l.task}</td>
                        <td>{l.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === "leave" ? (
            leaves === null ? (
              <LoadingBlock rows={3} card={false} />
            ) : leaves.length === 0 ? (
              <EmptyState icon={FileText} title="No leave history" body="Leave requests will appear here." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr key={l.id}>
                        <td>{l.kind}</td>
                        <td><span className="cell-muted">{l.from}</span></td>
                        <td><span className="cell-muted">{l.to}</span></td>
                        <td>{l.days}</td>
                        <td><StatusBadge status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: "10px 12px" }}>
      <span className="cell-muted" style={{ fontSize: 11 }}>{label}</span>
      <div className="ldr-big-num" style={{ fontSize: 19, marginTop: 3 }}>{value}</div>
    </div>
  );
}
