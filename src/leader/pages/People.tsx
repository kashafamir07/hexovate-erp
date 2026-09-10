import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Search, UserRound } from "lucide-react";
import { hrApi, type PeopleItem, type PersonDetail } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { isOrgKind, type RoleConfig } from "../nav";
import { PageHead, PersonCell, ScorePill, SectionCard, StatusBadge } from "../widgets";
import { downloadCsv } from "../util";

export function LeaderPeoplePage({ cfg }: { cfg: RoleConfig }) {
  const { push } = useToasts();
  const [items, setItems] = useState<PeopleItem[] | null>(null);
  const [filters, setFilters] = useState<{ departments: { id: string; name: string }[]; designations: string[] }>({ departments: [], designations: [] });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [designation, setDesignation] = useState("");
  const [profile, setProfile] = useState<PersonDetail | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const orgWide = isOrgKind(cfg.kind);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (q) params.search = q;
      if (dept) params.department = dept;
      if (status) params.status = status;
      if (designation) params.designation = designation;
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
  }, [q, dept, status, designation]);

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
      ["Employee ID", "Name", "Job Title", "Department", "Employment status", "Attendance today", "Performance score", "Open tasks"],
      items.map((p) => [p.employeeId || "", p.name, p.jobTitle || "", p.departmentName || "", p.status, p.today, p.score ?? "", p.openTasks])
    );
    push("Employee report exported", "success");
  }, [items, push]);

  const scopeTitle = orgWide ? "Employees" : "My Team";

  const columns = useMemo(
    () => [
      { key: "id", header: "Employee ID" },
      { key: "name", header: "Employee" },
      { key: "designation", header: "Designation" },
      { key: "dept", header: "Department", hide: !orgWide },
      { key: "status", header: "Employment" },
      { key: "today", header: "Attendance" },
      { key: "score", header: "Score" },
      { key: "tasks", header: "Open tasks" },
    ],
    [orgWide]
  );

  return (
    <section className="page">
      <PageHead
        title={scopeTitle}
        subtitle={`${orgWide ? "Organization-wide people directory for oversight" : "Your direct reports"} — ${total} ${total === 1 ? "person" : "people"}`}
        actions={
          <Button variant="white" size="sm" onClick={exportRows} disabled={!items?.length}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export report
          </Button>
        }
      />

      <div className="ldr-toolbar">
        <span className="search-input">
          <Search aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, title, email…" aria-label="Search employees" />
        </span>
        {orgWide ? (
          <Select ariaLabel="Department filter" value={dept} onChange={setDept} options={[{ value: "", label: "All departments" }, ...filters.departments.map((d) => ({ value: d.id, label: d.name }))]} />
        ) : null}
        <Select ariaLabel="Employment status filter" value={status} onChange={setStatus} options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "invited", label: "Invited" }]} />
        <Select ariaLabel="Designation filter" value={designation} onChange={setDesignation} options={[{ value: "", label: "All designations" }, ...filters.designations.map((d) => ({ value: d, label: d }))]} />
        <span className="ldr-spacer" />
        <span className="ldr-count">{total} results</span>
      </div>

      {items === null && !error ? (
        <LoadingBlock rows={5} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : items && items.length === 0 ? (
        <EmptyState icon={UserRound} title="No employees found" body="Adjust the search or filters to see people." />
      ) : items ? (
        <SectionCard>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.filter((c) => !c.hide).map((c) => (
                    <th key={c.key}>{c.header}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td><span className="cell-muted ldr-nowrap">{p.employeeId || "—"}</span></td>
                    <td>
                      <PersonCell person={p} sub={p.email} />
                    </td>
                    <td><span className="cell-muted">{p.jobTitle || "—"}</span></td>
                    {orgWide ? <td><span className="cell-muted">{p.departmentName || "—"}</span></td> : null}
                    <td><StatusBadge status={p.status} /></td>
                    <td><StatusBadge status={p.today} /></td>
                    <td><ScorePill score={p.score} /></td>
                    <td>{p.openTasks}</td>
                    <td className="ldr-table-actions">
                      <Button variant="soft" size="sm" onClick={() => void openProfile(p.id)}>
                        <Eye aria-hidden="true" style={{ width: 13, height: 13 }} /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <ProfileModal open={Boolean(profileId)} onClose={() => setProfileId(null)} detail={profile} />
    </section>
  );
}

function ProfileModal({ open, onClose, detail }: { open: boolean; onClose: () => void; detail: PersonDetail | null }) {
  return (
    <Modal open={open} onClose={onClose} title={detail?.profile.name || "Employee profile"} width={760}>
      {!detail ? (
        <LoadingBlock rows={3} card={false} />
      ) : (
        <div className="ldr-stack">
          <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", padding: 14 }}>
            <span className="avatar" style={{ background: detail.profile.color, width: 56, height: 56, fontSize: 18 }}>
              {detail.profile.initials}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{detail.profile.name}</h3>
              <span className="cell-muted">
                {detail.profile.jobTitle}
                {detail.profile.departmentName ? ` · ${detail.profile.departmentName}` : ""}
              </span>
              <br />
              <span className="cell-muted">
                {detail.profile.employeeId}
                {detail.profile.managerName ? ` · Reports to ${detail.profile.managerName}` : ""}
              </span>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              {detail.metrics.perfLatest ? <ScorePill score={detail.metrics.perfLatest.score} /> : null}
              <br />
              <span className="cell-muted">{detail.metrics.leaveBalance} leave days left</span>
            </div>
          </div>

          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", marginBottom: 0 }}>
            <MiniStat label="Attendance (month)" value={detail.metrics.attendanceMonth.rate != null ? `${detail.metrics.attendanceMonth.rate}%` : "—"} />
            <MiniStat label="Present / Late / Absent" value={`${detail.metrics.attendanceMonth.present} / ${detail.metrics.attendanceMonth.late} / ${detail.metrics.attendanceMonth.absent}`} />
            <MiniStat label="Leave used (30d)" value={String(detail.metrics.leaveUsedMonth)} />
            <MiniStat label="Open tasks" value={String(detail.metrics.openTasks)} />
            <MiniStat label="Completed tasks" value={String(detail.metrics.completedTasks)} />
          </div>

          {detail.tasks.length > 0 ? (
            <div>
              <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Open tasks</h4>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Priority</th>
                    </tr>
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
            </div>
          ) : null}

          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Performance history</h4>
            {detail.metrics.reviews.length === 0 ? (
              <p className="cell-muted">No reviews on record.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Score</th>
                      <th>Rating</th>
                      <th>Status</th>
                      <th>Reviewer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.metrics.reviews.map((r) => (
                      <tr key={r.id}>
                        <td>{r.period}</td>
                        <td>{r.score ? <ScorePill score={r.score} /> : "—"}</td>
                        <td><span className="cell-muted">{r.rating || "—"}</span></td>
                        <td><StatusBadge status={r.status} /></td>
                        <td><span className="cell-muted">{r.reviewer || "—"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
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
