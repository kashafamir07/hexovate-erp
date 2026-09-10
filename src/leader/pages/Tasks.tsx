import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check, Plus, Search, Trash2 } from "lucide-react";
import { hrApi, type TeamTask } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { isOrgKind, type RoleConfig } from "../nav";
import { PageHead, PersonCell, SectionCard, StatusBadge } from "../widgets";
import { isoOffset } from "../util";

const STATUS_UI: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "In Review", completed: "Done" };

export function LeaderTasksPage({ cfg }: { cfg: RoleConfig }) {
  const { push } = useToasts();
  const [items, setItems] = useState<TeamTask[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [employee, setEmployee] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (employee) params.employee = employee;
      if (q) params.search = q;
      const data = await hrApi.teamTasks(params);
      setItems(data.items);
      setCounts(data.statusCounts);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [status, priority, employee, q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (creating && people.length === 0) {
      void hrApi.people().then((d) => setPeople(d.items.map((p) => ({ id: p.id, name: p.name })))).catch(() => undefined);
    }
  }, [creating, people.length]);

  const setRowStatus = async (task: TeamTask, next: string) => {
    try {
      await hrApi.updateTask(task.id, { status: next });
      push(next === "completed" ? "Task completed" : `Task moved to ${STATUS_UI[next]}`, "success");
      void reload();
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const remove = async (task: TeamTask) => {
    try {
      await hrApi.deleteTask(task.id);
      push("Task deleted", "success");
      void reload();
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!items || !counts) return <LoadingBlock rows={5} />;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section className="page">
      <PageHead
        title="Tasks"
        subtitle={`${isOrgKind(cfg.kind) ? "Company-wide" : "Team"} tasks — create, assign and track progress`}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> Assign task
          </Button>
        }
      />

      <div className="ldr-kpis">
        <MiniStat label="All tasks" value={String(total)} />
        <MiniStat label="To do" value={String(counts.todo || 0)} />
        <MiniStat label="In progress" value={String(counts.in_progress || 0)} />
        <MiniStat label="In review" value={String(counts.review || 0)} />
        <MiniStat label="Completed" value={String(counts.completed || 0)} />
      </div>

      <SectionCard>
        <div className="ldr-toolbar" style={{ marginBottom: 10 }}>
          <span className="search-input">
            <Search aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
          </span>
          <Select ariaLabel="Status filter" value={status} onChange={setStatus} options={[{ value: "", label: "All statuses" }, { value: "To Do", label: "To Do" }, { value: "In Progress", label: "In Progress" }, { value: "In Review", label: "In Review" }, { value: "Done", label: "Done" }]} />
          <Select ariaLabel="Priority filter" value={priority} onChange={setPriority} options={[{ value: "", label: "All priorities" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          <Select ariaLabel="Assignee filter" value={employee} onChange={setEmployee} options={[{ value: "", label: "All people" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          <span className="ldr-spacer" />
          <span className="ldr-count">{items.length} tasks</span>
        </div>

        {items.length === 0 ? (
          <EmptyState icon={CalendarPlus} title="No tasks match" body="Assign a task or widen the filters." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td>
                      <strong className="cell-strong">{t.title}</strong>
                      <br />
                      <span className="cell-muted">{t.project || "No project"}</span>
                    </td>
                    <td>{t.assignee ? <PersonCell person={t.assignee} /> : <span className="cell-muted">Unassigned</span>}</td>
                    <td><Badge tone={t.priorityKey === "high" ? "danger" : t.priorityKey === "medium" ? "warning" : "success"}>{t.priority}</Badge></td>
                    <td><span className="cell-muted ldr-nowrap">{t.due}</span></td>
                    <td>
                      {t.status === "completed" ? (
                        <StatusBadge status={t.statusLabel} />
                      ) : (
                        <Select
                          ariaLabel={`Status for ${t.title}`}
                          value={t.status}
                          onChange={(v) => void setRowStatus(t, v)}
                          options={Object.entries(STATUS_UI).map(([value, label]) => ({ value, label }))}
                        />
                      )}
                    </td>
                    <td className="ldr-table-actions">
                      {t.status !== "completed" ? (
                        <Button variant="soft" size="sm" onClick={() => void setRowStatus(t, "completed")}>
                          <Check aria-hidden="true" style={{ width: 13, height: 13 }} /> Complete
                        </Button>
                      ) : (
                        <Button variant="soft" size="sm" onClick={() => void setRowStatus(t, "todo")}>Reopen</Button>
                      )}
                      <Button variant="danger-soft" size="sm" onClick={() => void remove(t)} aria-label={`Delete ${t.title}`}>
                        <Trash2 aria-hidden="true" style={{ width: 13, height: 13 }} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <CreateTaskModal open={creating} onClose={() => setCreating(false)} people={people} onCreated={() => { setCreating(false); void reload(); }} />
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

function CreateTaskModal({ open, onClose, people, onCreated }: { open: boolean; onClose: () => void; people: { id: string; name: string }[]; onCreated: () => void }) {
  const { push } = useToasts();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState(isoOffset(7));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      push("A task title is required", "error");
      return;
    }
    if (!assignee) {
      push("Choose who to assign the task to", "error");
      return;
    }
    setBusy(true);
    try {
      await hrApi.createTask({ title: title.trim(), assignedTo: assignee, priority, dueDate });
      push("Task assigned", "success");
      onCreated();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign a task" width={520}>
      <div className="ldr-stack">
        <div className="field">
          <label htmlFor="nt-title">Task title</label>
          <input id="nt-title" className="field-input" placeholder="e.g. Prepare sprint review notes" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nt-assignee">Assignee</label>
          <Select ariaLabel="Assignee" value={assignee} onChange={setAssignee} size="md" options={people.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label htmlFor="nt-priority">Priority</label>
            <Select ariaLabel="Priority" value={priority} onChange={setPriority} size="md" options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          </div>
          <div className="field">
            <label htmlFor="nt-due">Due date</label>
            <input id="nt-due" type="date" className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="white" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? "Assigning…" : "Assign task"}</Button>
        </div>
      </div>
    </Modal>
  );
}
