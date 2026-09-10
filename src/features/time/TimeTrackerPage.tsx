import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Toggle } from "../../components/ui/Toggle";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";


import { timeApi, type CurrentTimer } from "../../api/time";
import { projectsApi } from "../../api/projects";
import type { TimeEntry } from "../../data/time";

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDur(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Labels for the current week's days (server monthDay format) to scope "This Week". */
function weekDayLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    labels.push(`${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()}`);
  }
  return labels;
}

type Scope = "week" | "all";

/** Time Tracker (Employee board 27). */
export function TimeTrackerPage() {
  const [rows, setRows] = useState<TimeEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("week");
  const [project, setProject] = useState("all");
  const [billableOnly, setBillableOnly] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [timer, setTimer] = useState<CurrentTimer | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [sp, setSp] = useSearchParams();
  const { push } = useToasts();
  const tick = useRef<number | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await timeApi.list({});
      setRows(res.items);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  useEffect(() => {
    void load();
    projectsApi.list({}).then((p) => setProjectNames(Array.from(new Set(p.items.map((x) => x.name))))).catch(() => undefined);
    timeApi
      .current()
      .then((cur) => {
        if (cur) {
          setTimer(cur);
          setRunning(true);
          setPaused(false);
          setElapsed(cur.startElapsed);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sp.get("start") === "1") {
      setRunning(true);
      setPaused(false);
      setElapsed(0);
      sp.delete("start");
      setSp(sp, { replace: true });
    } else if (sp.get("manual") === "1") {
      setManualOpen(true);
      sp.delete("manual");
      setSp(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running || paused) return;
    tick.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running, paused]);

  const weekLabels = weekDayLabels();
  const visible = (rows ?? []).filter((r) => {
    if (scope === "week" && !weekLabels.includes(r.date)) return false;
    if (project !== "all" && r.project !== project) return false;
    if (billableOnly && r.billable !== "Billable") return false;
    return true;
  });

  const exportCsv = () => {
    const header = "Date,Task,Project,Duration,Billable";
    const body = visible.map((r) => [r.date, r.task, r.project, r.duration, r.billable].map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-tracker.csv";
    a.click();
    URL.revokeObjectURL(url);
    push("CSV exported", "success");
  };

  const startTimer = async () => {
    try {
      const cur = await timeApi.start({ description: "Working" });
      setTimer(cur);
      setRunning(true);
      setPaused(false);
      setElapsed(cur.startElapsed);
      push("Timer started", "success");
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const stopTimer = async () => {
    if (timer) {
      try {
        const entry = await timeApi.stop();
        setRows((prev) => (prev ? [entry, ...prev] : [entry]));
        push(`Logged ${entry.duration} to ${entry.project}`, "success");
      } catch (e) {
        push(errorMessage(e), "error");
      }
    }
    setRunning(false);
    setPaused(false);
    setTimer(null);
    setElapsed(0);
  };

  const projectOptions = [{ value: "all", label: "Project" }, ...projectNames.map((n) => ({ value: n, label: n }))];

  const columns: Column<TimeEntry>[] = [
    { id: "date", header: "Date", render: (r) => <span className="cell-muted">{r.date}</span> },
    { id: "task", header: "Task", render: (r) => <span className="cell-strong">{r.task}</span> },
    { id: "project", header: "Project", render: (r) => <span className="cell-muted">{r.project}</span> },
    { id: "duration", header: "Duration", render: (r) => <span className="cell-strong">{r.duration}</span> },
    {
      id: "billable",
      header: "Billable",
      render: (r) => <Badge tone={r.billable === "Billable" ? "success" : "gray"}>{r.billable}</Badge>,
    },
    {
      id: "manual",
      header: "",
      render: (r) => (r.manual ? <Badge tone="warning">Manual</Badge> : null),
      className: "col-actions",
    },
  ];

  return (
    <section className="page">
      <div className="page-head">
        <h1>Time Tracker</h1>
        <div className="page-head-actions">
          <Button variant="soft" onClick={exportCsv}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
          <Link className="btn btn--ghost btn--md" to="/time-tracker/timesheet">
            Weekly Timesheet
          </Link>
        </div>
      </div>

      {/* Currently tracking */}
      <div className="tracker-hero">
        <div>
          <p className="kicker">{running && !paused ? "Currently tracking" : "Tracking paused"}</p>
          <p className="ttl">
            {timer ? `${timer.task} — ${timer.project}` : "No active timer"}
          </p>
          <p className="clock" aria-live="off">
            {running ? formatClock(elapsed) : "—"}
          </p>
        </div>
        <div className="hero-actions">
          <Button
            variant="white"
            style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.7)" }}
            onClick={() => {
              if (!running) {
                void startTimer();
              } else if (paused) {
                setPaused(false);
                push("Timer resumed", "success");
              } else {
                setPaused(true);
                push("Timer paused", "success");
              }
            }}
          >
            {!running ? "Start" : paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="white" onClick={() => void stopTimer()}>
            Stop
          </Button>
        </div>
      </div>

      <div className="tracker-toolbar">
        <button type="button" className={`filter-tab ${scope === "week" ? "active" : ""}`.trim()} onClick={() => setScope("week")}>
          This Week
        </button>
        <button type="button" className={`filter-tab ${scope === "all" ? "active" : ""}`.trim()} onClick={() => setScope("all")}>
          All Time
        </button>
        <Select value={project} onChange={setProject} ariaLabel="Filter by project" options={projectOptions} />
        <button type="button" className="billable-toggle" aria-pressed={billableOnly} onClick={() => setBillableOnly((v) => !v)}>
          <span className={`checkbox ${billableOnly ? "checkbox--checked" : "checkbox--unchecked"}`.trim()} style={{ width: 15, height: 15 }}>
            {billableOnly ? "✓" : ""}
          </span>
          Billable Only
        </button>
        <div className="right">
          <Button variant="soft" size="sm" onClick={() => setManualOpen(true)}>
            <Plus aria-hidden="true" />
            Manual Entry
          </Button>
        </div>
      </div>

      {rows === null && !loadError ? (
        <LoadingBlock rows={6} />
      ) : loadError ? (
        <ErrorBlock message={loadError} onRetry={() => void load()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={visible} keyOf={(r) => r.id} />
        </div>
      )}

      {/* Manual entry modal */}
      <ManualEntryModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreate={(entry) => {
          setRows((prev) => (prev ? [entry, ...prev] : [entry]));
          push("Time entry saved", "success");
        }}
      />
    </section>
  );
}

function ManualEntryModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (e: TimeEntry) => void }) {
  const { push } = useToasts();
  const [billable, setBillable] = useState(true);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ project: "", duration: "1h 45m", date: "", notes: "" });

  useEffect(() => {
    projectsApi.list({}).then((p) => {
      setProjects(p.items.map((x) => ({ id: x.id, name: x.name })));
      if (!form.project && p.items.length > 0) setForm((f) => ({ ...f, project: p.items[0].id }));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const hMatch = form.duration.match(/(\d+)h/);
    const mMatch = form.duration.match(/(\d+)m/);
    const minutes = Math.max(15, (hMatch ? Number(hMatch[1]) * 60 : 0) + (mMatch ? Number(mMatch[1]) : 0));
    if (!form.project) {
      onCreate({ id: `e${Date.now()}`, date: "—", task: form.notes || "Time entry", project: "Internal", duration: form.duration, minutes, billable: billable ? "Billable" : "Non-billable", manual: true });
      onClose();
      return;
    }
    try {
      const entry = await timeApi.manual({
        project: form.project,
        description: form.notes || undefined,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        minutes,
        billable,
      });
      onCreate(entry);
      onClose();
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const options = projects.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Modal open={open} onClose={onClose} title="Log Time Manually" width={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="field">
          <label htmlFor="me-project">Project</label>
          <Select size="md" value={form.project} onChange={(v) => setForm({ ...form, project: v })} options={options} ariaLabel="Project" />
        </div>
        <div className="field">
          <label htmlFor="me-task">Task</label>
          <input id="me-task" className="field-input" placeholder="What did you work on?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label="Task" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="me-date">Date</label>
            <input id="me-date" type="date" className="field-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="me-dur">Duration</label>
            <input id="me-dur" className="field-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Toggle checked={billable} onChange={setBillable} label="Billable" />
          <span className="field-hint">Billable</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()}>Save Entry</Button>
        </div>
      </div>
    </Modal>
  );
}
