import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Search } from "lucide-react";
import { hrApi, STATUS_COLORS } from "../../api/hr";
import type { BadgeTone } from "../../types";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { isOrgKind, type RoleConfig } from "../nav";
import { BarChart, LineChart, PageHead, PersonCell, SectionCard, StatusBadge } from "../widgets";
import { downloadCsv } from "../util";

type TodayRow = {
  id: string; employeeId: string; name: string; initials: string; color: string; jobTitle: string; departmentName: string; status: string; statusLabel: string; checkIn: string; hours: string;
};

export function LeaderAttendancePage({ cfg }: { cfg: RoleConfig }) {
  const { push } = useToasts();
  const [today, setToday] = useState<{ date: string; counts: { present: number; late: number; absent: number; leave: number }; rate: number | null; rows: TodayRow[] } | null>(null);
  const [monthly, setMonthly] = useState<{ key: string; label: string; rate: number | null; present: number; late: number; absent: number; leave: number }[] | null>(null);
  const [trend, setTrend] = useState<{ label: string; value: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "late" | "absent" | "leave">("all");
  const [employee, setEmployee] = useState("");
  const [hist, setHist] = useState<TodayRow | null>(null);
  const [history, setHistory] = useState<{ id: string; dateLabel: string; status: string; statusLabel: string; clockIn: string; clockOut: string; hours: string }[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, m, tr] = await Promise.all([hrApi.attendanceToday(), hrApi.attendanceSummary(8), hrApi.attendanceTrend(8)]);
      setToday(t as typeof today);
      setMonthly(m.monthly);
      setTrend(tr.points);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!today) return [];
    const rows = [...today.rows];
    if (view === "all") return rows;
    const wanted = view === "leave" ? ["leave"] : [view];
    return rows.filter((r) => wanted.includes(r.status));
  }, [today, view]);

  const openHistory = useCallback(async (row: TodayRow) => {
    setHist(row);
    setHistory(null);
    try {
      const h = await hrApi.attendanceHistory(row.id, 45);
      setHistory(h.items);
    } catch {
      setHistory([]);
    }
  }, []);

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!today || !monthly || !trend) return <LoadingBlock rows={5} />;

  const counts = today.counts;
  const activeCount = counts.present + counts.late + counts.absent + counts.leave;
  const filterTabs = [
    { id: "all", label: `All (${today.rows.length})` },
    { id: "late", label: `Late (${counts.late})` },
    { id: "absent", label: `Absent (${counts.absent})` },
    { id: "leave", label: `On leave (${counts.leave})` },
  ] as const;

  return (
    <section className="page">
      <PageHead
        title="Attendance"
        subtitle={`${isOrgKind(cfg.kind) ? "Company-wide" : "Team"} attendance — ${today.date}`}
        actions={
          <Button variant="white" size="sm" onClick={() => downloadCsv("attendance-today", ["Employee ID", "Employee", "Department", "Status", "Check in", "Hours"], filtered.map((r) => [r.employeeId, r.name, r.departmentName, r.statusLabel, r.checkIn, r.hours]))}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export today
          </Button>
        }
      />

      <div className="ldr-kpis">
        <MiniStat label="Attendance rate" value={today.rate != null ? `${today.rate}%` : "—"} />
        <MiniStat label="Present" value={String(counts.present)} />
        <MiniStat label="Late" value={String(counts.late)} />
        <MiniStat label="Absent" value={String(counts.absent)} />
        <MiniStat label="On leave" value={String(counts.leave)} />
        <MiniStat label="Tracked today" value={String(activeCount)} />
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard
            title="Today's Roster"
            action={
              <div style={{ display: "flex", gap: 4 }}>
                {filterTabs.map((t) => (
                  <button key={t.id} type="button" className={`filter-tab ${view === t.id ? "active" : ""}`.trim()} onClick={() => setView(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nobody matches this view" body="Everyone is accounted for in this status today." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Designation</th>
                      {isOrgKind(cfg.kind) ? <th>Department</th> : null}
                      <th>Status</th>
                      <th>Check in</th>
                      <th>Hours</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 1 ? "striped" : ""}>
                        <td><PersonCell person={r} sub={r.employeeId} /></td>
                        <td><span className="cell-muted">{r.jobTitle}</span></td>
                        {isOrgKind(cfg.kind) ? <td><span className="cell-muted">{r.departmentName}</span></td> : null}
                        <td><StatusBadge status={r.statusLabel} /></td>
                        <td><span className="cell-muted ldr-nowrap">{r.checkIn}</span></td>
                        <td><span className="cell-muted">{r.hours}</span></td>
                        <td className="ldr-table-actions">
                          <Button variant="soft" size="sm" onClick={() => void openHistory(r)}>
                            History
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="ldr-col">
          <SectionCard title="Attendance Trend (weekly)">
            <LineChart points={trend} unit="%" height={120} />
          </SectionCard>
          <SectionCard title="Monthly Attendance Summary">
            <BarChart points={monthly.map((m) => ({ label: m.label, value: m.rate ?? 0 }))} unit="%" height={120} />
          </SectionCard>
        </div>
      </div>

      <EmployeeHistoryModal
        open={Boolean(hist)}
        onClose={() => setHist(null)}
        row={hist}
        items={history}
        employee={employee}
        setEmployee={setEmployee}
        scopeRows={today.rows}
      />
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

function EmployeeHistoryModal({ open, onClose, row, items, employee, setEmployee, scopeRows }: {
  open: boolean; onClose: () => void; row: TodayRow | null; items: { id: string; dateLabel: string; status: string; statusLabel: string; clockIn: string; clockOut: string; hours: string }[] | null; employee: string; setEmployee: (v: string) => void; scopeRows: TodayRow[];
}) {
  void items;
  return (
    <Modal open={open} onClose={onClose} title={row ? `Attendance history — ${row.name}` : "Attendance history"} width={640}>
      <div className="ldr-stack">
        <div className="ldr-toolbar" style={{ marginBottom: 0 }}>
          <span className="search-input" style={{ maxWidth: 240 }}>
            <Search aria-hidden="true" />
            <Select
              value={employee || row?.id || ""}
              onChange={setEmployee}
              options={scopeRows.map((r) => ({ value: r.id, label: r.name }))}
              size="md"
              ariaLabel="Employee"
            />
          </span>
          <span className="cell-muted">Last 60 workdays</span>
        </div>
        <HistoryListFor employeeId={employee || row?.id || null} />
      </div>
    </Modal>
  );
}

function HistoryListFor({ employeeId }: { employeeId: string | null }) {
  const [data, setData] = useState<{ items: { id: string; dateLabel: string; status: string; statusLabel: string; clockIn: string; clockOut: string; hours: string }[]; lastMonthRate: number | null } | null>(null);
  useEffect(() => {
    if (!employeeId) return;
    let live = true;
    setData(null);
    hrApi.attendanceHistory(employeeId, 60).then((d) => live && setData(d)).catch(() => live && setData({ items: [], lastMonthRate: null }));
    return () => { live = false; };
  }, [employeeId]);

  if (!data) return <LoadingBlock rows={4} card={false} />;
  if (data.items.length === 0) return <EmptyState icon={CalendarDays} title="No attendance records" />;
  return (
    <div className="table-scroll" id="hist-list">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>In</th>
            <th>Out</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((r, i) => (
            <tr key={r.id} className={i % 2 === 1 ? "striped" : ""}>
              <td className="ldr-nowrap">{r.dateLabel}</td>
              <td>
                <Badge tone={(STATUS_COLORS[r.status] as BadgeTone) || "gray"}>{r.statusLabel}</Badge>
              </td>
              <td>{r.clockIn}</td>
              <td>{r.clockOut}</td>
              <td>{r.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
