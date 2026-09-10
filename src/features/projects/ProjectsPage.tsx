import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { projectsApi } from "../../api/projects";
import { projectStatusTone, type Project } from "../../data/projects";

type Scope = "all" | "mine";

/** Projects (Employee board 17) — card grid with scope/status/date filters. */
export function ProjectsPage() {
  const [all, setAll] = useState<Project[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.list({});
      setAll(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = all.filter((p) => {
    if (scope === "mine" && p.status === "Completed") return false;
    if (status !== "all" && p.status !== status) return false;
    if (range === "current" && (p.status === "Completed" || p.status === "On Hold")) return false;
    return true;
  });

  return (
    <section className="page">
      <div className="page-head">
        <h1>Projects</h1>
        <div className="page-head-actions">
          <Button onClick={() => all.length > 0 && navigate(`/projects/${all[0].id}`)}>
            <Plus aria-hidden="true" />
            New Project
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        <button type="button" className={`filter-tab ${scope === "all" ? "active" : ""}`.trim()} onClick={() => setScope("all")}>
          All
        </button>
        <button type="button" className={`filter-tab ${scope === "mine" ? "active" : ""}`.trim()} onClick={() => setScope("mine")}>
          My Projects
        </button>
        <Select
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
          options={[
            { value: "all", label: "Status" },
            { value: "Active", label: "Active" },
            { value: "On Hold", label: "On Hold" },
            { value: "Completed", label: "Completed" },
          ]}
        />
        <Select
          value={range}
          onChange={setRange}
          ariaLabel="Filter by date range"
          options={[
            { value: "all", label: "Date Range" },
            { value: "current", label: "Current (active)" },
            { value: "q4", label: "Next quarter" },
          ]}
        />
      </div>

      {loading ? (
        <div className="project-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="skel" style={{ height: 18, width: "55%" }} />
              <div className="skel" style={{ width: "85%" }} />
              <div className="skel" style={{ width: "40%" }} />
              <div className="skel" style={{ height: 6, width: "100%", borderRadius: 3 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No projects match these filters.</div>
      ) : (
        <div className="project-grid">
          {visible.map((p) => (
            <button key={p.id} type="button" className="card project-card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="title-row">
                <h3>{p.name}</h3>
                <Badge tone={projectStatusTone[p.status]}>{p.status}</Badge>
              </div>
              <p className="desc">{p.description}</p>
              <span className="members">
                {p.members.map((m) => (
                  <span key={m.initials} className="avatar avatar--sm" style={{ background: m.color, width: 24, height: 24, fontSize: 10 }}>{m.initials}</span>
                ))}
                <span className="avatar avatar--sm" style={{ background: "#6B7280", width: 24, height: 24, fontSize: 10, marginLeft: -6 }}>+{Math.max(0, p.memberTotal - p.members.length)}</span>
              </span>
              <div className="progress" style={{ marginTop: 12 }}>
                <span style={{ width: `${p.progress}%` }} />
              </div>
              <div className="foot">
                <span>{p.progress}% complete</span>
                <span>Due {p.due}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
