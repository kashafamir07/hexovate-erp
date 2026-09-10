import { useEffect, useState } from "react";
import { ErrorBlock } from "../../components/ui/Async";
import { timesheetsApi, type TimesheetView } from "../../api/timesheets";

/** Weekly Timesheet (Employee board 29): hours per project per weekday. */
export function WeeklyTimesheetPage() {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<TimesheetView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (weeks: number) => {
    setView(null);
    setError(null);
    try {
      const data = await timesheetsApi.currentWeek(weeks);
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the timesheet");
    }
  };

  useEffect(() => {
    void load(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const go = (delta: number) => setOffset((o) => o + delta);

  return (
    <section className="page">
      <div className="page-head">
        <h1>Weekly Timesheet</h1>
        <div className="page-head-actions">
          <button type="button" className="btn btn--ghost btn--md" onClick={() => go(-1)}>
            Prev Week
          </button>
          <button type="button" className="btn btn--ghost btn--md" onClick={() => go(1)}>
            Next Week
          </button>
        </div>
      </div>
      <p className="page-subhead sub">{view?.weekLabel ?? "Loading week…"}</p>

      {error ? (
        <ErrorBlock message={error} onRetry={() => void load(offset)} />
      ) : !view ? (
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skel" style={{ height: 14, width: "100%" }} />
          <div className="skel" style={{ height: 14, width: "90%" }} />
          <div className="skel" style={{ height: 14, width: "70%" }} />
          <div className="skel" style={{ height: 14, width: "40%" }} />
        </div>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table className="data-table timesheet">
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>Project</th>
                  {view.days.map((d) => (
                    <th key={d} style={{ minWidth: 74 }}>{d}</th>
                  ))}
                  <th style={{ minWidth: 70 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.length === 0 ? (
                  <tr>
                    <td colSpan={view.days.length + 2}>
                      <span className="cell-muted">No time logged this week yet.</span>
                    </td>
                  </tr>
                ) : (
                  view.rows.map((row) => (
                    <tr key={row.project}>
                      <td>
                        <span className="cell-strong">{row.project}</span>
                      </td>
                      {row.days.map((d, i) => (
                        <td key={i}>
                          <span className="cell-muted">{d ?? "—"}</span>
                        </td>
                      ))}
                      <td>
                        <span className="cell-strong">{row.total}</span>
                      </td>
                    </tr>
                  ))
                )}
                <tr className="timesheet-total">
                  <td>
                    <strong style={{ fontSize: 15 }}>Total</strong>
                  </td>
                  {view.totals.map((d, i) => (
                    <td key={i}>
                      <strong style={{ fontSize: 15 }}>{d}</strong>
                    </td>
                  ))}
                  <td>
                    <strong style={{ fontSize: 15 }}>{view.grandTotal}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
