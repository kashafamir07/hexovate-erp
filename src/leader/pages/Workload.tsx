import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { hrApi, type Person } from "../../api/hr";
import { errorMessage } from "../../api/client";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHead, SectionCard, PersonCell } from "../widgets";
import type { RoleConfig } from "../nav";

type LoadRow = Person & { open: number; done: number };

function loadTone(open: number): "danger" | "warning" | "success" {
  if (open >= 6) return "danger";
  if (open >= 3) return "warning";
  return "success";
}

function loadLabel(open: number): string {
  if (open >= 6) return "Heavy";
  if (open >= 3) return "Moderate";
  return "Light";
}

export function LeaderWorkloadPage({ cfg }: { cfg: RoleConfig }) {
  const [rows, setRows] = useState<LoadRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await hrApi.taskStats();
      setRows(data.perEmployee as LoadRow[]);
      setCounts(data.statusCounts);
      setOpen(data.open);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!rows || !counts || open == null) return <LoadingBlock rows={5} />;

  return (
    <section className="page">
      <PageHead title="Workload" subtitle="Open and completed task load per team member — spot imbalances before they become bottlenecks." />

      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Gauge} title="No workload data" body="Assign tasks to team members to see their load here." />
        </SectionCard>
      ) : (
        <SectionCard title="Team load" action={<span className="ldr-count">{open} open · {counts.completed || 0} done</span>}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Open tasks</th>
                  <th>Completed</th>
                  <th style={{ minWidth: 220 }}>Load</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.open - a.open)
                  .map((r, i) => {
                    const total = r.open + r.done;
                    const pct = total ? Math.round((r.open / total) * 100) : 0;
                    const tone = loadTone(r.open);
                    return (
                      <tr key={r.id} className={i % 2 === 1 ? "striped" : ""}>
                        <td><PersonCell person={r} /></td>
                        <td><strong className="ldr-num">{r.open}</strong></td>
                        <td><span className="cell-muted">{r.done}</span></td>
                        <td>
                          <div className="wl-bar" role="img" aria-label={`${r.name}: ${pct}% of tasks open`}>
                            <span className={`wl-bar-fill wl-bar-fill--${tone}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td><Badge tone={tone}>{loadLabel(r.open)}</Badge></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </section>
  );
}