import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ListChecks, Target } from "lucide-react";
import { hrApi, type CeoDashboardData, type PriorityRow } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageHead, SectionCard } from "../widgets";
import type { ShellContext } from "../LeaderShell";
import type { RoleConfig } from "../nav";
import type { BadgeTone } from "../../types";

const PRIORITY_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "warning" },
  review: { label: "Review", tone: "violet" },
  healthy: { label: "Healthy", tone: "success" },
  draft: { label: "Draft", tone: "gray" },
  at_risk: { label: "At risk", tone: "danger" },
  done: { label: "Done", tone: "gray" },
};

const moneyM = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
};

function CeoKpiCard({ label, value, sub, tone = "good" }: { label: string; value: string; sub?: string; tone?: "good" | "muted" }) {
  return (
    <section className="card ceo-kpi">
      <span className="ceo-kpi-label">{label}</span>
      <span className="ceo-kpi-value">{value}</span>
      {sub ? <span className={`ceo-kpi-sub ceo-kpi-sub--${tone}`}>{sub}</span> : null}
    </section>
  );
}

function PriorityBadge({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const meta = PRIORITY_STATUS[status] || { label: status, tone: "gray" as BadgeTone };
  if (overdue) return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function PrioritiesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<PriorityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setRows(null);
    setError(null);
    hrApi
      .priorities()
      .then((items) => {
        if (alive) setRows(items);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load priorities");
      });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="drawer-overlay" role="presentation" onMouseDown={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Executive priorities" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Executive priorities</h2>
          <button type="button" className="icon-btn-flat" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-body">
          {!rows && !error ? <p className="cell-muted">Loading priorities…</p> : null}
          {error ? (
            <div>
              <p className="cell-muted">{error}</p>
              <Button variant="soft" size="sm" onClick={() => setRows(null)}>
                Retry
              </Button>
            </div>
          ) : null}
          {rows && rows.length === 0 ? <p className="cell-muted">No priorities yet — add one from the strategy review.</p> : null}
          {rows && rows.length > 0 ? (
            <ul className="ceo-pri-list">
              {rows.map((p) => (
                <li key={p.id} className="ceo-pri">
                  <span className="ceo-pri-body">
                    <strong className="ceo-pri-title">{p.title}</strong>
                    <br />
                    <span className="ceo-pri-meta">
                      {p.area ? `${p.area} · ` : ""}
                      {p.dueLabel}
                      {p.description ? ` — ${p.description}` : ""}
                    </span>
                  </span>
                  <span className="ceo-pri-badge">
                    <PriorityBadge status={p.status} overdue={p.overdue} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Figma "MD / Executive" dashboard — Revenue / Headcount / Active Projects /
 * Pending Decisions KPIs, Executive Priorities and the Company Snapshot. */
export function CeoDashboard({ cfg }: { cfg: RoleConfig }) {
  useOutletContext<ShellContext>();
  const [dash, setDash] = useState<CeoDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPriorities, setShowPriorities] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await hrApi.dashboard();
      setDash(d.ceo || null);
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

  const revSub = dash.revenue.growthPct != null ? `${dash.revenue.growthPct > 0 ? "+" : ""}${dash.revenue.growthPct}%` : null;
  const headSub = dash.headcount.delta > 0 ? `+${dash.headcount.delta} this month` : null;

  return (
    <section className="page">
      <PageHead
        title="Dashboard"
        actions={
          <Button variant="primary" size="md" onClick={() => setShowPriorities(true)}>
            <Target aria-hidden="true" style={{ width: 14, height: 14 }} /> View priorities
          </Button>
        }
      />

      <div className="ceo-kpis">
        <CeoKpiCard label="Revenue" value={moneyM(dash.revenue.annualized)} sub={revSub || undefined} />
        <CeoKpiCard label="Headcount" value={String(dash.headcount.value)} sub={headSub || undefined} />
        <CeoKpiCard label="Active Projects" value={String(dash.projects.value)} sub={dash.projects.dueSoon > 0 ? `${dash.projects.dueSoon} due soon` : "None due soon"} tone={dash.projects.dueSoon > 0 ? "good" : "muted"} />
        <CeoKpiCard label="Pending Decisions" value={String(dash.decisions.value)} sub={dash.decisions.urgent > 0 ? `${dash.decisions.urgent} urgent` : "Nothing urgent"} tone={dash.decisions.urgent > 0 ? "good" : "muted"} />
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard
            title={
              <span className="ceo-card-title">
                <ListChecks aria-hidden="true" /> Executive Priorities
              </span>
            }
            action={
              <Button variant="soft" size="sm" onClick={() => setShowPriorities(true)}>
                View all
              </Button>
            }
          >
            {dash.priorities.length > 0 ? (
              <ul className="ceo-pri-list">
                {dash.priorities.map((p) => (
                  <li key={p.id} className="ceo-pri">
                    <span className="ceo-pri-body">
                      <strong className="ceo-pri-title">{p.title}</strong>
                      <br />
                      <span className="ceo-pri-meta">
                        {p.area ? `${p.area} · ` : ""}
                        {p.dueLabel}
                      </span>
                    </span>
                    <span className="ceo-pri-badge">
                      <PriorityBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No executive priorities yet.</p>
            )}
          </SectionCard>
        </div>

        <div className="ldr-col">
          <SectionCard title="Company Snapshot">
            {dash.snapshot.length > 0 ? (
              <ul className="ceo-snap">
                {dash.snapshot.map((s) => (
                  <li key={s.dept} className="ceo-snap-row">
                    <span className="ceo-snap-top">
                      <strong className="ceo-snap-name">{s.dept}</strong>
                      <span className="ceo-snap-pct">{s.pct}%</span>
                    </span>
                    <span className="progress ceo-snap-bar" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.dept}: ${s.pct}%`}>
                      <span style={{ width: `${s.pct}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No department data yet.</p>
            )}
          </SectionCard>
        </div>
      </div>

      <PrioritiesDrawer open={showPriorities} onClose={() => setShowPriorities(false)} />
    </section>
  );
}
