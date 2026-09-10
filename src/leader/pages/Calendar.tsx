import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hrApi, type CalendarDay } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHead, SectionCard } from "../widgets";
import type { RoleConfig } from "../nav";

const ICON: Record<string, string> = {
  leave: "leave",
  "leave-pending": "leave-pending",
  task: "task",
  milestone: "milestone",
};

export function LeaderCalendarPage({ cfg }: { cfg: RoleConfig }) {
  void cfg;
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ monthLabel: string; counts: { leaves: number; tasks: number }; days: CalendarDay[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    try {
      setData(await hrApi.calendar(d.getMonth() + 1, d.getFullYear()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead
        title="Team Calendar"
        subtitle="Leave, task deadlines and important dates for your team"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <strong style={{ minWidth: 150, textAlign: "center", fontSize: 14 }}>{data?.monthLabel || "…"}</strong>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setOffset((o) => Math.min(0, o + 1))}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
            <MiniStat label="Approved + pending leave" value={String(data.counts.leaves)} />
            <MiniStat label="Task deadlines" value={String(data.counts.tasks)} />
            <MiniStat label="Days with events" value={String(data.days.length)} />
          </div>

          <SectionCard title={data.monthLabel}>
            {data.days.length === 0 ? (
              <EmptyState icon={CalendarIcon} title="Quiet month" body="No leave, deadlines or milestones in this month." />
            ) : (
              <div>
                {data.days.map((day) => (
                  <div className="ldr-cal-day" key={day.date}>
                    <h4>{day.label}</h4>
                    {day.items.slice(0, 6).map((it, i) => (
                      <div className="ldr-cal-item" key={i}>
                        <span className={`ic ic--${ICON[it.type] || "task"}`}>{it.type === "leave" ? "Leave" : it.type === "leave-pending" ? "Pending" : it.type === "milestone" ? "Milestone" : "Task"}</span>
                        <span>
                          <strong>{it.title}</strong>
                          <span className="cell-muted"> · {it.meta}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card ldr-kpi">
      <span className="ldr-kpi-label">{label}</span>
      <span className="ldr-kpi-value" style={{ fontSize: 22 }}>{value}</span>
    </div>
  );
}

// lucide import kept explicit to avoid unused-import churn
import { CalendarDays as CalendarIcon } from "lucide-react";
