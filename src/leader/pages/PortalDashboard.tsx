import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, CalendarOff, Megaphone, UserPlus, UserRound, Users } from "lucide-react";
import { hrApi, type PortalDashboardData } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { PageHead, SectionCard } from "../widgets";
import type { ShellContext } from "../LeaderShell";
import { useOutletContext } from "react-router-dom";
import { greeting, todayLabel } from "../util";

const KPI_META = [
  { key: "headcount", label: "Team Headcount", icon: Users },
  { key: "pendingApprovals", label: "Pending Approvals", icon: CalendarCheck },
  { key: "onLeave", label: "On Leave Today", icon: CalendarOff },
  { key: "openPositions", label: "Open Positions", icon: UserRound },
] as const;

/** Figma "HR Portal / Dashboard" — KPIs, Pending Approvals table, Attendance
 * Snapshot, Birthdays & Anniversaries, Company Announcement, Team Activity. */
export function PortalDashboard({ variant = "hr" }: { variant?: "hr" | "dh" }) {
  useOutletContext<ShellContext>();
  const navigate = useNavigate();
  const [data, setData] = useState<PortalDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await hrApi.portalDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const kpis = [
    { ...KPI_META[0], value: data.kpis.headcount, note: data.kpis.newHires > 0 ? `↑ ${data.kpis.newHires} new this month` : "—", tone: "up" },
    { ...KPI_META[1], value: data.kpis.pendingApprovals, note: data.approvals.some((a) => a.urgent) ? "⚠ 2 waiting 3+ days" : "Within SLA", tone: data.approvals.some((a) => a.urgent) ? "down" : "flat" },
    { ...KPI_META[2], value: data.kpis.onLeave, note: data.kpis.onLeave > 0 ? "See attendance snapshot" : "Everyone in today", tone: "flat" },
    { ...KPI_META[3], value: data.kpis.openPositions, note: data.openPositionsNote || "No open roles", tone: "up" },
  ];

  const dhTitle = variant === "dh" ? "Department" : "Team";

  return (
    <section className="page">
      <PageHead
        title={greeting(data.greetingName)}
        subtitle={`${todayLabel()}${data.scope?.name ? ` · ${data.scope.name}` : ""}`}
        actions={
          <Button variant="primary" size="md" onClick={() => navigate("/hr/announcements")}>
            <Megaphone aria-hidden="true" style={{ width: 14, height: 14 }} /> New Announcement
          </Button>
        }
      />

      <div className="ldr-kpis portal-kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <section className="card ldr-kpi" key={k.key}>
              <span className="ldr-kpi-icon">
                <Icon aria-hidden="true" />
              </span>
              <div className="ldr-kpi-body">
                <span className="ldr-kpi-value">{k.value}</span>
                <span className="ldr-kpi-label">{k.label}</span>
                <span className={`portal-kpi-note ${k.tone === "down" ? "is-bad" : k.tone === "up" ? "is-good" : ""}`}>{k.note}</span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="portal-grid">
        <div className="portal-main">
          <SectionCard
            title="Pending Approvals"
            action={
              <Button variant="soft" size="sm" onClick={() => navigate(variant === "dh" ? "/dh/approvals" : "/hr/approvals")}>
                View all ({data.kpis.pendingApprovals})
              </Button>
            }
          >
            {data.approvals.length > 0 ? (
              <div className="table-scroll">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Dates / Amount</th>
                      <th>Waiting</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.approvals.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <span className="person-cell">
                            {a.person ? <Avatar initials={a.person.initials} color={a.person.color} title={a.person.name} /> : <Avatar initials="?" color="#6b7280" />}
                            <span>
                              <strong>{a.person?.name ?? "Unknown"}</strong>
                              <br />
                              <span className="cell-muted">{a.person?.jobTitle || a.dept}</span>
                            </span>
                          </span>
                        </td>
                        <td>{a.kind}</td>
                        <td>{a.detail}</td>
                        <td>{a.waitingLabel}</td>
                        <td>
                          <Button variant="soft" size="sm" onClick={() => navigate(variant === "dh" ? "/dh/approvals" : "/hr/approvals")}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mgr-empty">No pending approvals — the queue is clear. 🎉</p>
            )}
          </SectionCard>

          <SectionCard title={`${dhTitle} Activity`}>
            {data.activity.length > 0 ? (
              <ul className="portal-activity">
                {data.activity.map((a) => (
                  <li key={a.id} className="portal-activity-row">
                    <Avatar initials={a.initials} color={a.color} title={a.name} />
                    <span className="portal-activity-body">
                      <span className="portal-activity-text">{a.text}</span>
                      <br />
                      <span className="portal-activity-time">{a.when}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No recent activity.</p>
            )}
          </SectionCard>
        </div>

        <div className="portal-side">
          <SectionCard title="Attendance Snapshot">
            <div className="portal-att-top">
              <span className="portal-att-label">Present</span>
              <span className="portal-att-count">{data.attendance.present}</span>
            </div>
            <div className="progress portal-att-bar" role="progressbar" aria-valuenow={data.attendance.rate ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Attendance rate ${data.attendance.rate ?? 0}%`}>
              <span style={{ width: `${data.attendance.rate ?? 0}%` }} />
            </div>
            <ul className="portal-att-rows">
              <li>
                <span>On Leave</span>
                <strong>{data.attendance.onLeave}</strong>
              </li>
              <li>
                <span>Late Check-in</span>
                <strong>{data.attendance.late}</strong>
              </li>
              <li>
                <span>Absent</span>
                <strong>{data.attendance.absent}</strong>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Birthdays & Anniversaries">
            {data.events.length > 0 ? (
              <ul className="portal-events">
                {data.events.map((ev) => (
                  <li key={ev.id} className="portal-event">
                    <Avatar initials={ev.person.initials} color={ev.person.color} title={ev.person.name} />
                    <span className="portal-event-body">
                      <strong>{ev.label}</strong>
                    </span>
                    <span className="portal-event-when">{ev.when}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No birthdays or anniversaries in the next 30 days.</p>
            )}
          </SectionCard>

          <SectionCard title="Company Announcement">
            {data.announcement ? (
              <div className="portal-announce">
                <strong className="portal-announce-title">{data.announcement.title}</strong>
                <p className="portal-announce-body">{data.announcement.content}</p>
                <span className="portal-announce-meta">
                  {data.announcement.author} · {data.announcement.when}
                </span>
              </div>
            ) : (
              <p className="mgr-empty">No announcements published yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Quick Links">
            <ul className="portal-quick">
              <li>
                <button type="button" onClick={() => navigate("/hr/onboarding")}>
                  <UserPlus aria-hidden="true" /> Onboarding <Badge tone="primary">{data.onboardingCount}</Badge>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate("/hr/reports")}>
                  Reports & documents
                </button>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
