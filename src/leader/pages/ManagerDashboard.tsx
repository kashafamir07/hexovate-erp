import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  Clock,
  Plus,
  Users,
} from "lucide-react";
import { useAuth, useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { hrApi, type DashboardPayload, type Kpi } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { SectionCard, PageHead } from "../widgets";
import type { ShellContext } from "../LeaderShell";
import type { RoleConfig } from "../nav";
import { greeting, todayLabel } from "../util";

const KPI_META: Record<string, { icon: typeof Users; label: string; tone?: "danger" }> = {
  teamSize: { icon: Users, label: "Team Members" },
  activeTasks: { icon: CheckSquare, label: "Active Tasks" },
  overdueTasks: { icon: AlertTriangle, label: "Overdue Tasks", tone: "danger" },
  teamHours: { icon: Clock, label: "Team Hours (wk)" },
};

/** Figma "Manager Role" chips: up = green, down = red, flat = none. */
function TrendChip({ trend }: { trend: NonNullable<Kpi["trend"]> }) {
  if (trend.dir === "flat") return null;
  const Icon = trend.dir === "down" ? ArrowDownRight : ArrowUpRight;
  const tone = trend.dir === "up" ? "up" : "down";
  return (
    <span className={`ldr-chip ldr-chip--${tone}`}>
      <Icon aria-hidden="true" />
      {trend.label}
    </span>
  );
}

function MgrKpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = KPI_META[kpi.id]?.icon || Users;
  const meta = KPI_META[kpi.id];
  return (
    <section className="card ldr-kpi" key={kpi.id}>
      <span className={`ldr-kpi-icon ${meta?.tone ? "ldr-kpi-icon--danger" : ""}`.trim()}>
        <Icon aria-hidden="true" />
      </span>
      <div className="ldr-kpi-body">
        <span className="ldr-kpi-label">{meta?.label || kpi.label}</span>
        <span className="ldr-kpi-value">{kpi.value}</span>
        {/* Figma "Manager Role" cards show only the trend chip — no static subtext */}
        {kpi.trend ? (
          <span className="ldr-kpi-note">
            <TrendChip trend={kpi.trend} />
          </span>
        ) : null}
      </div>
    </section>
  );
}

const PRIORITY_TONE: Record<string, "danger" | "warning" | "success" | "gray"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

export function ManagerDashboard({ cfg }: { cfg: RoleConfig }) {
  useOutletContext<ShellContext>();
  const { user } = useAuth();
  const { push } = useToasts();
  const navigate = useNavigate();
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);

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

  const completeTask = async (id: string, title: string) => {
    if (busyTask) return;
    setBusyTask(id);
    try {
      await hrApi.updateTask(id, { status: "completed" });
      push(`Completed “${title}”`, "success");
      void load();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusyTask(null);
    }
  };

  if (!dash && !error) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!dash) return null;

  const mgr = dash.manager;
  const teamKpis = dash.kpis.filter((k) => KPI_META[k.id]);

  return (
    <section className="page">
      <PageHead
        title={greeting(user?.firstName)}
        subtitle={`Here's what's happening with your team today — ${todayLabel()}.`}
        actions={
          <>
            <Button variant="primary" size="md" onClick={() => navigate("/manager/tasks")}>
              <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> Create Task
            </Button>
            <Button variant="soft" size="md" onClick={() => navigate("/manager/reports")}>
              <CalendarPlus aria-hidden="true" style={{ width: 14, height: 14 }} /> Request Report
            </Button>
          </>
        }
      />

      <div className="ldr-kpis">
        {teamKpis.map((k) => (
          <MgrKpiCard key={k.id} kpi={k} />
        ))}
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="Tasks Due Today" action={<span className="ldr-count">{mgr?.tasksDueToday.length ?? 0} due</span>}>
            {mgr && mgr.tasksDueToday.length > 0 ? (
              <ul className="mgr-list">
                {mgr.tasksDueToday.map((t) => (
                  <li key={t.id} className="mgr-task">
                    <Checkbox checked={false} label={t.title} onClick={() => void completeTask(t.id, t.title)} />
                    <span className="mgr-task-body">
                      <strong className="mgr-task-title">{t.title}</strong>
                      <br />
                      <span className="mgr-task-meta">{t.project ? `${t.project} · ` : ""}{t.assignee ? t.assignee.name : "Unassigned"}</span>
                    </span>
                    <span className="mgr-task-avatar">
                      {t.assignee ? <Avatar initials={t.assignee.initials} color={t.assignee.color} title={t.assignee.name} /> : <Avatar initials="?" color="#6b7280" title="Unassigned" />}
                    </span>
                    <Badge tone={PRIORITY_TONE[t.priorityKey] || "gray"}>{t.priority}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No tasks due today — the team is all caught up. 🎉</p>
            )}
          </SectionCard>

          <SectionCard
            title="Active Projects"
            action={
              mgr && mgr.activeProjects.length > 0 ? (
                <Button variant="soft" size="sm" onClick={() => navigate("/manager/tasks")}>
                  View all <ArrowUpRight aria-hidden="true" style={{ width: 12, height: 12 }} />
                </Button>
              ) : undefined
            }
          >
            {mgr && mgr.activeProjects.length > 0 ? (
              <ul className="mgr-list">
                {mgr.activeProjects.map((p) => (
                  <li key={p.id} className="mgr-proj">
                    <div className="mgr-proj-top">
                      <span className="mgr-proj-name">{p.name}</span>
                      <span className="mgr-proj-meta">{p.dueLabel}</span>
                    </div>
                    <div className="progress project-progress" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: ${p.progress}% complete`}>
                      <span style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="pct-label">{p.progress}% complete</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No active projects on the team.</p>
            )}
          </SectionCard>

          <SectionCard title="Recent Team Activity" action={mgr && mgr.recentActivity.length > 0 ? <span className="ldr-count">{mgr.recentActivity.length} updates</span> : undefined}>
            {mgr && mgr.recentActivity.length > 0 ? (
              <ul className="mgr-list">
                {mgr.recentActivity.map((a) => (
                  <li key={a.id} className="mgr-activity">
                    <Avatar initials={a.initials} color={a.color} title={a.text} />
                    <span className="mgr-activity-body">
                      <span className="mgr-activity-text">{a.text}</span>
                      <br />
                      <span className="mgr-activity-time">{a.time}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No recent team activity.</p>
            )}
          </SectionCard>
        </div>

        <div className="ldr-col">
          <SectionCard title="Pending Requests">
            {mgr && mgr.pendingGroups.length > 0 ? (
              <ul className="mgr-list">
                {mgr.pendingGroups.map((g) => (
                  <li key={g.id}>
                    <button type="button" className="mgr-pending" onClick={() => navigate(g.to)}>
                      <span className="mgr-pending-label">
                        <ClipboardList aria-hidden="true" />
                        {g.label}
                      </span>
                      <span className="mgr-pending-right">
                        <Badge tone="warning">{g.count} Pending</Badge>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">Nothing pending — your inbox is clear.</p>
            )}
          </SectionCard>

          <SectionCard title="Upcoming Deadlines" action={mgr && mgr.upcomingDeadlines.length > 0 ? <span className="ldr-count">{mgr.upcomingDeadlines.length} upcoming</span> : undefined}>
            {mgr && mgr.upcomingDeadlines.length > 0 ? (
              <ul className="mgr-list">
                {mgr.upcomingDeadlines.map((d) => (
                  <li key={d.id} className="mgr-deadline">
                    <span className="mgr-deadline-body">
                      <strong className="mgr-deadline-task">{d.title}</strong>
                      <br />
                      <span className="mgr-task-meta">{d.project}</span>
                    </span>
                    <span className="mgr-deadline-date">{d.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No upcoming deadlines.</p>
            )}
          </SectionCard>

          <SectionCard title="Team Online">
            {mgr && mgr.teamOnline.people.length > 0 ? (
              <>
                <span className="avatar-stack">
                  {mgr.teamOnline.people.map((p) => (
                    <Avatar key={p.id} initials={p.initials} color={p.color} title={p.name} />
                  ))}
                  {mgr.teamOnline.count > 5 ? <Avatar initials={`+${mgr.teamOnline.count - 5}`} color="#94a3b8" title={`${mgr.teamOnline.count - 5} more online`} /> : null}
                </span>
                <p className="mgr-online-note">
                  <Clock aria-hidden="true" /> {mgr.teamOnline.count} of {mgr.teamOnline.total} online
                </p>
              </>
            ) : (
              <p className="mgr-empty">Nobody is marked online right now.</p>
            )}
          </SectionCard>

          <SectionCard title="Attendance Summary" action={mgr && mgr.attendanceSummary.length > 0 ? <span className="ldr-count">today</span> : undefined}>
            {mgr && mgr.attendanceSummary.length > 0 ? (
              <ul className="mgr-att">
                {mgr.attendanceSummary.map((a) => (
                  <li key={a.label} className="mgr-att-row">
                    <span className="mgr-att-label">{a.label}</span>
                    <span className="mgr-att-value">{a.value}</span>
                    {a.note ? <span className="mgr-att-note">{a.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No attendance marks yet today.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}