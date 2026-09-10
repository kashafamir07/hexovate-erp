import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { hrApi, type OrgHomeData } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { BarChart } from "../widgets";
import type { RoleConfig } from "../nav";
import { useAuth } from "../../lib/AppProviders";

const TONE_CLASS: Record<string, string> = {
  up: "home-delta home-delta--up",
  down: "home-delta home-delta--down",
  warn: "home-delta home-delta--warn",
};

function DeltaChip({ delta }: { delta: { text: string; tone: "up" | "down" | "warn" } }) {
  const Icon = delta.tone === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={TONE_CLASS[delta.tone]}>
      <Icon aria-hidden="true" style={{ width: 12, height: 12 }} />
      {delta.text}
    </span>
  );
}

/**
 * "CEO" / "Company_Admin" Figma board:
 * greeting banner, 4 KPI cards (Total Employees / Active Departments /
 * Active Projects / Pending Approvals), 7-day Company Activity bar chart,
 * Departments Overview, Pending Approvals table and Upcoming Deadlines.
 */
export function OrgHomeDashboard({ cfg }: { cfg: RoleConfig }) {
  const { user } = useAuth();
  const [home, setHome] = useState<OrgHomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHome(await hrApi.orgHome());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!home && !error) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!home) return null;

  const base = cfg.base;

  return (
    <section className="page">
      {/* Greeting banner */}
      <div className="home-greet">
        <h1 className="home-greet-title">{home.greeting || `Good day, ${user?.firstName || "there"}`}</h1>
        <p className="home-greet-sub">
          {home.dateLine} — {home.intro}
        </p>
      </div>

      {/* KPI row */}
      <div className="home-kpis">
        {home.kpis.map((k) => (
          <section className="card home-kpi" key={k.id}>
            <div className="home-kpi-value">{k.value}</div>
            <div className="home-kpi-label">{k.label}</div>
            {k.delta ? <DeltaChip delta={k.delta} /> : <span className="home-delta-placeholder" aria-hidden="true" />}
          </section>
        ))}
      </div>

      <div className="home-grid">
        {/* Left column — activity chart + approvals table */}
        <div className="home-col">
          {home.activity.some((a) => a.value > 0) ? (
            <section className="card home-section">
              <h2 className="home-section-title">Company Activity — Last 7 Days</h2>
              <BarChart points={home.activity} unit=" hrs" height={170} />
            </section>
          ) : (
            <section className="card home-section">
              <h2 className="home-section-title">Company Activity — Last 7 Days</h2>
              <p className="cell-muted" style={{ margin: "18px 0", fontSize: 13 }}>
                No tracked hours in the last 7 days. Activity will appear here as teams log time.
              </p>
            </section>
          )}

          <section className="card home-section">
            <div className="home-section-head">
              <h2 className="home-section-title" style={{ margin: 0 }}>Pending Approvals</h2>
              <Link className="home-link" to={`${base}/approvals`}>View all</Link>
            </div>
            {home.approvals.items.length === 0 ? (
              <p className="cell-muted" style={{ fontSize: 13 }}>No pending approvals — the inbox is clear.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table home-approvals">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Summary</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.approvals.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="home-person">
                            <Avatar initials={r.initials} color={r.color} title={r.employee} className="avatar--sm" />
                            <span>{r.employee}</span>
                          </span>
                        </td>
                        <td><span className="cell-muted">{r.kind}</span></td>
                        <td>{r.summary}</td>
                        <td><Badge tone="warning">{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right column — departments + deadlines */}
        <div className="home-col home-col--side">
          <section className="card home-section">
            <h2 className="home-section-title">Departments Overview</h2>
            {home.departments.length === 0 ? (
              <p className="cell-muted" style={{ fontSize: 13 }}>No departments yet.</p>
            ) : (
              <ul className="home-dept-list">
                {home.departments.map((d) => (
                  <li key={d.name}>
                    <span>{d.name}</span>
                    <span className="cell-muted">{d.people} {d.people === 1 ? "person" : "people"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card home-section">
            <h2 className="home-section-title">Upcoming Deadlines</h2>
            {home.deadlines.length === 0 ? (
              <p className="cell-muted" style={{ fontSize: 13 }}>No upcoming project deadlines.</p>
            ) : (
              <ul className="home-deadlines">
                {home.deadlines.map((d) => (
                  <li key={d.id}>
                    <span className="home-deadline-title">{d.title}</span>
                    <span className="cell-muted home-deadline-date">{d.due}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link className="home-link home-link--tail" to={`${base}/projects`}>
              View projects <ArrowRight aria-hidden="true" style={{ width: 13, height: 13 }} />
            </Link>
          </section>
        </div>
      </div>
    </section>
  );
}
