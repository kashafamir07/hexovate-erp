import { useCallback, useEffect, useState } from "react";
import { Building2, FolderKanban } from "lucide-react";
import { hrApi, type DeptRow } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import type { RoleConfig } from "../nav";
import { PageHead, SectionCard, StatusBadge } from "../widgets";
import { FmtMoney } from "../widgets";

export function DeptGrid({ rows }: { rows: DeptRow[] }) {
  if (rows.length === 0) return <EmptyState icon={Building2} title="No departments yet" />;
  const total = rows.reduce((s, r) => s + r.headcount, 0);
  return (
    <div className="ldr-dept-grid">
      {rows.map((d) => (
        <section className="card ldr-section" key={d.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{d.name}</h3>
            <StatusBadge status={d.status} />
          </div>
          <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 12px", minHeight: 30 }}>{d.description || "—"}</p>
          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px,1fr))", gap: 6, marginBottom: 0 }}>
            <MiniStat label="Headcount" value={String(d.headcount)} />
            <MiniStat label="Attendance" value={d.attendance != null ? `${d.attendance}%` : "—"} />
            <MiniStat label="Avg perf" value={d.score != null ? String(d.score) : "—"} />
            <MiniStat label="Open roles" value={String(d.openPositions)} />
            <MiniStat label="Pending" value={String(d.pendingApprovals)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <span className="cell-muted">Head: <strong className="cell-strong">{d.manager}</strong></span>
            <span className="cell-muted">{total ? `${Math.round((d.headcount / total) * 100)}% of org` : ""}</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="cell-muted" style={{ fontSize: 10.5, display: "block" }}>{label}</span>
      <strong className="ldr-num" style={{ fontSize: 16 }}>{value}</strong>
    </div>
  );
}

export function ExecDepartmentsPage(_: { cfg: RoleConfig }) {
  const [rows, setRows] = useState<DeptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await hrApi.departments());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load departments");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="page">
      <PageHead title="Departments" subtitle="Department health — headcount, attendance, performance and open positions" />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : !rows ? <LoadingBlock rows={6} /> : <DeptGrid rows={rows} />}
    </section>
  );
}

export function ExecOrgOverviewPage(_: { cfg: RoleConfig }) {
  const [rows, setRows] = useState<DeptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await hrApi.departments());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the organization");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!rows) return <LoadingBlock rows={6} />;

  const totals = {
    depts: rows.length,
    headcount: rows.reduce((s, r) => s + r.headcount, 0),
    open: rows.reduce((s, r) => s + r.openPositions, 0),
    pending: rows.reduce((s, r) => s + r.pendingApprovals, 0),
  };

  return (
    <section className="page">
      <PageHead title="Organization Overview" subtitle="The company structure at a glance — every department, its leadership and live signals" />
      <div className="ldr-kpis">
        <Kpi label="Departments" value={String(totals.depts)} />
        <Kpi label="Active employees" value={String(totals.headcount)} />
        <Kpi label="Open positions" value={String(totals.open)} />
        <Kpi label="Pending approvals" value={String(totals.pending)} />
      </div>
      <DeptGrid rows={rows} />
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <section className="card ldr-kpi">
      <span className="ldr-kpi-icon"><FolderKanban aria-hidden="true" /></span>
      <div className="ldr-kpi-body">
        <span className="ldr-kpi-label">{label}</span>
        <span className="ldr-kpi-value">{value}</span>
      </div>
    </section>
  );
}

export function PayrollPage(_: { cfg: RoleConfig }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof hrApi.payroll>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await hrApi.payroll(month || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payroll");
    }
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock rows={5} />;

  return (
    <section className="page">
      <PageHead
        title="Payroll Overview"
        subtitle={`Monthly payroll for ${data.month} — ${data.items.length} employees`}
        actions={<Select ariaLabel="Payroll month" value={month || data.month} onChange={(v) => setMonth(v === data.month ? "" : v)} options={data.months.map((m) => ({ value: m.key, label: m.label }))} />}
      />
      <div className="ldr-kpis">
        <Kpi label="Net payroll" value={FmtMoney(data.summary.net)} />
        <Kpi label="Gross" value={FmtMoney(data.summary.base + data.summary.allowances)} />
        <Kpi label="Allowances" value={FmtMoney(data.summary.allowances)} />
        <Kpi label="Deductions" value={FmtMoney(data.summary.deductions)} />
        <Kpi label="Employees" value={String(data.summary.employees)} />
      </div>
      <SectionCard title="Monthly cost trend">
        <BarBars points={data.months.map((m) => ({ label: m.label, value: m.net }))} />
      </SectionCard>
      <SectionCard title={`Pay records — ${data.month}`}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Base</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r, i) => (
                <tr key={r.id} className={i % 2 === 1 ? "striped" : ""}>
                  <td className="cell-strong">{r.name}</td>
                  <td><span className="cell-muted">{r.departmentName}</span></td>
                  <td>{r.base}</td>
                  <td>{r.allowances}</td>
                  <td>{r.deductions}</td>
                  <td><strong className="ldr-num">{r.net}</strong></td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </section>
  );
}

import { BarChart as BarBars } from "../widgets";

export function RecruitmentPage(_: { cfg: RoleConfig }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof hrApi.recruitment>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await hrApi.recruitment());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recruitment");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock rows={5} />;

  return (
    <section className="page">
      <PageHead title="Recruitment" subtitle="Open positions and hiring momentum across the company" />
      <div className="ldr-kpis">
        <Kpi label="Open roles" value={String(data.summary.open)} />
        <Kpi label="Active postings" value={String(data.summary.postings)} />
        <Kpi label="Applicants" value={String(data.summary.applicants)} />
        <Kpi label="Hired" value={String(data.summary.hired)} />
      </div>
      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="Hires by month">
            <BarBars points={data.trend} />
          </SectionCard>
        </div>
        <div className="ldr-col">
          <SectionCard title="Open positions">
            {data.items.length === 0 ? (
              <EmptyState icon={Building2} title="No postings" />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Department</th>
                      <th>Openings</th>
                      <th>Applicants</th>
                      <th>Hired</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 1 ? "striped" : ""}>
                        <td>
                          <strong className="cell-strong">{p.title}</strong>
                          <br />
                          <span className="cell-muted">{p.location} · posted {p.postedLabel}</span>
                        </td>
                        <td><span className="cell-muted">{p.departmentName}</span></td>
                        <td>{p.openings}</td>
                        <td>{p.applicants}</td>
                        <td>{p.hired}</td>
                        <td><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
