import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Select } from "../../components/ui/Select";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { orgApi, type OrgNode } from "../../api/org";

const deptOptions = [
  { value: "all", label: "All Departments" },
  { value: "leadership", label: "Leadership" },
  { value: "engineering", label: "Engineering" },
  { value: "marketing", label: "Marketing" },
];

/** Org Chart (Employee board 15) — tree served by GET /api/org-chart. */
export function OrgChartPage() {
  const [dept, setDept] = useState("all");
  const [query, setQuery] = useState("");
  const [root, setRoot] = useState<OrgNode | null>(null);
  const [nodes, setNodes] = useState<Record<string, OrgNode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orgApi.chart();
      setRoot(data.root);
      setNodes(data.nodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the org chart");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const hidden = (n?: OrgNode) => {
    if (!n) return true;
    const deptHidden = dept !== "all" && (n.dept ?? "") !== dept;
    const q = query.trim().toLowerCase();
    const searchHidden = q.length > 0 && !n.name.toLowerCase().includes(q);
    return deptHidden || searchHidden;
  };

  if (loading) {
    return (
      <section className="page">
        <div className="page-head"><h1>Org Chart</h1></div>
        <LoadingBlock rows={6} />
      </section>
    );
  }
  if (error || !root) {
    return (
      <section className="page">
        <div className="page-head"><h1>Org Chart</h1></div>
        <ErrorBlock message={error || "No org data yet"} onRetry={() => void load()} />
      </section>
    );
  }

  const execs = root.reports ?? [];

  return (
    <section className="page">
      <div className="page-head">
        <h1>Org Chart</h1>
        <div className="chart-tools">
          <Select value={dept} onChange={setDept} options={deptOptions} ariaLabel="Department" />
          <label className="select select--sm" style={{ minWidth: 180 }}>
            <span className="select-trigger" style={{ width: "100%" }}>
              <span className="select-icon">
                <Search aria-hidden="true" />
              </span>
              <input
                style={{ border: 0, outline: 0, background: "transparent", font: "inherit", width: "100%", color: "var(--ink)" }}
                placeholder="Find Person"
                aria-label="Find Person"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>
        </div>
      </div>

      <div className="card org-card">
        <div className="org-tree">
          <OrgNodeCard node={root} dim={hidden(root)} />
          <div className="org-stem" />
          <div className="org-level" style={{ display: "flex", gap: 64, alignSelf: "stretch" }}>
            {execs.map((id) => (
              <div key={id} className="org-branch" style={{ alignItems: "center" }}>
                <OrgNodeCard node={nodes[id]} dim={hidden(nodes[id])} />
                <div className="org-stem" />
                <Leaves node={nodes[id]} dept={dept} query={query} nodes={nodes} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrgNodeCard({ node, dim }: { node?: OrgNode; dim?: boolean }) {
  if (!node) return null;
  return (
    <div className={`card org-node ${dim ? "dim" : ""}`.trim()}>
      <span className="avatar" style={{ background: node.color }}>{node.initials}</span>
      <span className="name">{node.name}</span>
      <span className="role">{node.role}</span>
      {node.reportsCount !== undefined ? <span className="reports">{node.reportsCount} reports</span> : null}
    </div>
  );
}

function Leaves({ node, dept, query, nodes }: { node?: OrgNode; dept: string; query: string; nodes: Record<string, OrgNode> }) {
  const ids = node?.reports ?? [];
  if (ids.length === 0) return null;
  const q = query.trim().toLowerCase();
  const visible = ids.filter((id) => {
    const n = nodes[id];
    if (!n) return false;
    const deptHidden = dept !== "all" && (n.dept ?? "") !== dept;
    const searchHidden = q.length > 0 && !n.name.toLowerCase().includes(q);
    return !deptHidden && !searchHidden;
  });
  if (visible.length === 0) return null;
  return (
    <div className="org-level" style={{ display: "flex", gap: 24 }}>
      {visible.map((id) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="org-stem" style={{ height: 16 }} />
          <OrgNodeCard node={nodes[id]} />
        </div>
      ))}
    </div>
  );
}
