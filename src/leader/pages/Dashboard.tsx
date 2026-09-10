import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRight, CalendarClock, ClipboardCheck, Users } from "lucide-react";
import { useAuth } from "../../lib/AppProviders";
import { hrApi, type DashboardPayload, type Person } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { AlertsList, BarChart, DistBars, Donut, KpiGrid, LineChart, PageHead, PersonCell, SectionCard, StatusBadge } from "../widgets";
import type { ShellContext } from "../LeaderShell";
import type { RoleConfig } from "../nav";
import { greeting, todayLabel } from "../util";

const CHART_META: Record<string, { title: string; unit?: string; kind: "line" | "bar" | "dist" | "donut" }> = {
  headcount: { title: "Employee Headcount Trend", kind: "line" },
  hiring: { title: "Recruitment / Hiring Trend", kind: "bar" },
  attendance: { title: "Attendance Trend", unit: "%", kind: "line" },
  leave: { title: "Leave Trend", unit: " days", kind: "line" },
  payroll: { title: "Payroll / Cost Trend", unit: " USD", kind: "bar" },
  performance: { title: "Performance Distribution", kind: "dist" },
  deptDist: { title: "Employees by Department", kind: "donut" },
  statusToday: { title: "Employee Status Today", kind: "donut" },
  activity: { title: "Monthly Team Activity", kind: "bar" },
};

function ChartCard({ id, points }: { id: string; points: { label: string; value: number }[] }) {
  const meta = CHART_META[id];
  if (!meta || points.length === 0) return null;
  return (
    <SectionCard title={meta.title}>
      {meta.kind === "line" ? <LineChart points={points} unit={meta.unit || ""} /> : null}
      {meta.kind === "bar" ? <BarChart points={points} unit={meta.unit || ""} /> : null}
      {meta.kind === "dist" ? <DistBars points={points} /> : null}
      {meta.kind === "donut" ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Donut points={points} label={id === "statusToday" ? "people" : "employees"} />
        </div>
      ) : null}
    </SectionCard>
  );
}

export function LeaderDashboard({ cfg }: { cfg: RoleConfig }) {
  useOutletContext<ShellContext>();
  const { user } = useAuth();
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDash(await hrApi.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!dash && !error) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!dash) return null;

  const isOrg = dash.scope.type === "org";
  const chartIds = isOrg
    ? ["headcount", "hiring", "attendance", "leave", "payroll", "deptDist", "performance"]
    : ["attendance", "leave", "performance", "statusToday", "activity"];

  return (
    <section className="page">
      <PageHead
        title={cfg.dashTitle}
        subtitle={`${greeting(user?.firstName)}, here's ${isOrg ? "the company" : dash.scope.name} at a glance — ${todayLabel()}.`}
        actions={<span className="ldr-count">{dash.scope.memberCount} {isOrg ? "employees" : "in scope"}</span>}
      />

      <KpiGrid kpis={dash.kpis} />

      <div className="ldr-cols">
        <div className="ldr-col">
          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: 0 }}>
            {chartIds.map((id) => (
              <ChartCard key={id} id={id} points={dash.charts[id] || []} />
            ))}
          </div>

          {!isOrg && dash.teamToday.length > 0 ? (
            <SectionCard title={isOrg ? "Department Performance" : "Team Status"} action={<span className="ldr-count">{dash.teamToday.length} people</span>}>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Designation</th>
                      <th>Today</th>
                      <th>Score</th>
                      <th>Open tasks</th>
                      <th>Current task</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.teamToday.slice(0, 8).map((m) => (
                      <tr key={m.id}>
                        <td>
                          <PersonCell person={{ id: m.id, name: m.name, initials: m.initials, color: m.color, jobTitle: m.jobTitle }} />
                        </td>
                        <td><span className="cell-muted">{m.jobTitle}</span></td>
                        <td><StatusBadge status={m.status} /></td>
                        <td>{m.score != null ? <strong className="ldr-num">{m.score}</strong> : <span className="cell-muted">—</span>}</td>
                        <td>{m.tasksOpen}</td>
                        <td><span className="cell-muted">{m.currentTask}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {isOrg && dash.deptPerf.length > 0 ? (
            <SectionCard title="Department Performance" action={<span className="ldr-count">{dash.deptPerf.length} departments</span>}>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Headcount</th>
                      <th>Attendance</th>
                      <th>Avg performance</th>
                      <th>Open positions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.deptPerf.map((d) => (
                      <tr key={d.dept}>
                        <td><strong className="cell-strong">{d.dept}</strong></td>
                        <td>{d.headcount}</td>
                        <td>{d.attendance != null ? `${d.attendance}%` : "—"}</td>
                        <td>{d.score != null ? <strong className="ldr-num">{d.score}</strong> : "—"}</td>
                        <td>{d.openPositions}</td>
                        <td><StatusBadge status={d.status === "On track" ? "active" : d.status === "Attention" ? "on_hold" : "rejected"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}
        </div>

        <div className="ldr-col">
          <SectionCard title="Alerts & Insights" action={<AlertsBadge n={dash.alerts.length} />}>
            <AlertsList alerts={dash.alerts} />
          </SectionCard>

          {dash.approvals.total > 0 ? (
            <SectionCard
              title="Pending Approvals"
              action={
                cfg.canDecide ? (
                  <Button variant="soft" size="sm" onClick={() => setOpenDrawer(true)}>
                    Review <ArrowRight aria-hidden="true" style={{ width: 13, height: 13 }} />
                  </Button>
                ) : undefined
              }
            >
              <ul className="ldr-alerts" style={{ gap: 6 }}>
                {dash.approvals.items.slice(0, 5).map((a) => (
                  <li key={a.id} className="ldr-alert ldr-alert--info" style={{ padding: "8px 10px" }}>
                    <span className="ldr-alert-icon">
                      <ClipboardCheck aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{a.description}</strong>
                      <br />
                      <span className="ldr-alert-body">
                        {a.kind} · {a.employee} · {a.submitted}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {dash.onLeaveToday.length > 0 ? (
            <SectionCard title="On Leave Today" action={<span className="ldr-count"><CalendarClock aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: -2 }} /> {dash.onLeaveToday.length}</span>}>
              <div className="ldr-stack">
                {dash.onLeaveToday.map((p: Person) => (
                  <PersonCell key={p.id} person={p} sub={p.jobTitle} />
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Workforce">
            <ul className="ldr-alerts" style={{ gap: 6 }}>
              <li className="ldr-alert ldr-alert--info" style={{ padding: "8px 10px" }}>
                <span className="ldr-alert-icon"><Users aria-hidden="true" /></span>
                <span>
                  <strong>{dash.scope.memberCount} people</strong>
                  <br />
                  <span className="ldr-alert-body">Today: {dash.scope.todayCounts.present} present · {dash.scope.todayCounts.late} late · {dash.scope.todayCounts.absent} absent · {dash.scope.todayCounts.onLeave} on leave</span>
                </span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      {openDrawer && cfg.canDecide ? (
        <DecisionsDrawer cfg={cfg} dash={dash} onClose={() => setOpenDrawer(false)} />
      ) : null}
    </section>
  );
}

function AlertsBadge({ n }: { n: number }) {
  return <span className="badge badge--warning">{n} open</span>;
}

function DecisionsDrawer({ cfg, dash, onClose }: { cfg: RoleConfig; dash: DashboardPayload; onClose: () => void }) {
  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Pending approvals" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Review approvals</h2>
          <button type="button" className="icon-btn-flat" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <p className="cell-muted">Open Approvals from the sidebar to decide these {dash.approvals.total} requests.</p>
        </div>
      </div>
    </div>
  );
}
