import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { projectsApi, type ProjectDetail } from "../../api/projects";
import type { ProjectStats } from "../../data/projects";
import { projectStatusTone } from "../../data/projects";

const tabs = ["Overview", "Board", "Sprints", "Gantt", "Files", "Wiki", "Discussions"] as const;

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Project Detail — Overview (Employee board 19). */
export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [tab, setTab] = useState<string>("Overview");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [activity, setActivity] = useState<{ text: string; time?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.get(projectId);
      setProject(data.project);
      setStats(data.stats);
      setActivity(data.activity ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <section className="page">
        <LoadingBlock rows={5} />
      </section>
    );
  }
  if (error || !project) {
    return (
      <section className="page">
        <div className="page-head"><h1>Project</h1></div>
        <ErrorBlock message={error || "Project not found"} onRetry={() => void load()} />
      </section>
    );
  }

  const shownMembers = project.members.slice(0, 2);
  const extraMembers = Math.max(0, project.members.length - shownMembers.length);

  return (
    <section className="page">
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1>{project.name}</h1>
          <Badge tone={projectStatusTone[project.status]}>{project.status}</Badge>
        </div>
        <div className="page-head-actions">
          {shownMembers.map((m) => (
            <span key={m.initials} className="avatar avatar--sm" style={{ background: m.color, width: 24, height: 24, fontSize: 10 }}>{m.initials}</span>
          ))}
          {extraMembers > 0 ? (
            <span className="avatar avatar--sm" style={{ background: "#6B7280", width: 24, height: 24, fontSize: 10 }}>+{extraMembers}</span>
          ) : null}
        </div>
      </div>

      <p className="page-subhead sub">
        {project.description} · {project.dateRange}
      </p>

      <div className="tabs" role="tablist" aria-label="Project sections">
        {tabs.map((t) =>
          t === "Board" ? (
            <Link key={t} to={`/projects/${project.id}/board`} className={`tab-link ${tab === t ? "active" : ""}`.trim()} onClick={() => setTab(t)}>
              {t}
            </Link>
          ) : (
            <button key={t} role="tab" aria-selected={tab === t} className={`tab-link ${tab === t ? "active" : ""}`.trim()} onClick={() => setTab(t)}>
              {t}
            </button>
          )
        )}
      </div>

      {tab === "Overview" ? (
        <>
          <div className="stat-row">
            <div className="card stat-mini"><span className="num primary">{stats?.total ?? 0}</span><span className="lbl">Total Tasks</span></div>
            <div className="card stat-mini"><span className="num success">{stats?.completed ?? 0}</span><span className="lbl">Completed</span></div>
            <div className="card stat-mini"><span className="num danger">{stats?.overdue ?? 0}</span><span className="lbl">Overdue</span></div>
            <div className="card stat-mini"><span className="num violet">{stats?.inReview ?? 0}</span><span className="lbl">In Review</span></div>
          </div>

          <div className="detail-grid">
            <div className="card budget-card">
              <h3>Budget Progress</h3>
              <div className="progress">
                <span style={{ width: `${project.budget.pct}%` }} />
              </div>
              <div className="budget-nums">
                <span>{fmtMoney(project.budget.spent)} spent</span>
                <span>{fmtMoney(project.budget.total)} budget</span>
              </div>
            </div>

            <div className="card act-card">
              <h3>Recent Activity</h3>
              <ul className="act-list">
                {activity.length === 0 ? (
                  <li>
                    <span className="dot" />
                    <span className="txt">No recent activity yet.</span>
                  </li>
                ) : (
                  activity.map((a, i) => (
                    <li key={i}>
                      <span className="dot" />
                      <span className="txt">{a.text}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
          {tab} content is not part of the Employee mock scope yet — the Board view is available above.
        </div>
      )}
    </section>
  );
}
