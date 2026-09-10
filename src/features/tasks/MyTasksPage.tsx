import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ClipboardList } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { projectsApi, type ProjectDetail } from "../../api/projects";
import { priorityTone, taskStatusTone, type TaskRow, type TaskStatus } from "../../data/tasks";

type FilterId = "all" | "today" | "overdue";

export function MyTasksPage() {
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [project, setProject] = useState("all");
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [sp, setSp] = useSearchParams();
  const { push } = useToasts();

  const load = async () => {
    try {
      setLoadError(null);
      const res = await tasksApi.list({ assigned: "me" });
      setRows(res.items);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  useEffect(() => {
    void load();
    projectsApi.list({ mine: "true" }).then((res) => setProjects(res.items as ProjectDetail[])).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deep link: /my-tasks?new=1 / ?task=design-pricing-page
  useEffect(() => {
    if (sp.get("new") === "1") {
      setNewTaskOpen(true);
      sp.delete("new");
      setSp(sp, { replace: true });
    }
    const taskId = sp.get("task");
    if (taskId === "design-pricing-page") {
      const found = (rows ?? []).find((r) => r.title === "Design pricing page");
      if (found) setOpenTask(found);
      sp.delete("task");
      setSp(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = rows ?? [];
  const counts = useMemo(
    () => ({
      all: list.length,
      today: list.filter((r) => r.dueLabel === "today").length,
      overdue: list.filter((r) => r.dueLabel === "overdue" && !r.done).length,
    }),
    [list]
  );

  const filtered = list.filter((r) => {
    if (filter === "today" && r.dueLabel !== "today") return false;
    if (filter === "overdue" && (r.dueLabel !== "overdue" || r.done)) return false;
    if (project !== "all" && r.projectId !== project) return false;
    return true;
  });

  const applyRow = (row: TaskRow) => {
    setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? row : r)));
  };

  const toggleDone = async (id: string, done: boolean) => {
    try {
      const row = await tasksApi.complete(id, done);
      applyRow(row);
      push(done ? "Task completed 🎉" : "Task reopened", done ? "success" : "error");
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const updateStatus = async (id: string, status: TaskStatus, done: boolean) => {
    try {
      const row = await tasksApi.update(id, { status });
      applyRow(row);
      if (done) push("Task completed 🎉", "success");
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const columns: Column<TaskRow>[] = [
    {
      id: "check",
      render: (r) => <Checkbox checked={r.done} label={r.title} onClick={() => void toggleDone(r.id, !r.done)} />,
      className: "col-check",
    },
    {
      id: "task",
      header: "Task",
      render: (r) => <span className="cell-strong">{r.title}</span>,
      className: "col-task",
    },
    { id: "project", header: "Project", render: (r) => <span className="cell-muted">{r.project}</span>, className: "col-project" },
    {
      id: "priority",
      header: "Priority",
      render: (r) => <Badge tone={priorityTone[r.priority]}>{r.priority}</Badge>,
      className: "col-priority",
    },
    { id: "due", header: "Due", render: (r) => <span className="cell-muted">{r.due}</span>, className: "col-due" },
    {
      id: "status",
      header: "Status",
      render: (r) => <Badge tone={taskStatusTone[r.status]}>{r.status}</Badge>,
      className: "col-status",
    },
  ];

  const [np, setNp] = useState({
    title: "",
    projectId: projects.length ? projects[0].id : "",
    priority: "Medium" as TaskRow["priority"],
    due: "",
  });

  const projectOptions = projects.length
    ? projects.map((p) => ({ value: p.id, label: p.name }))
    : [{ value: "", label: "Website Redesign" }];

  return (
    <section className="page">
      <div className="page-head">
        <h1>My Tasks</h1>
        <div className="page-head-actions">
          <Button onClick={() => setNewTaskOpen(true)}>
            <Plus aria-hidden="true" />
            New Task
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        {(
          [
            { id: "all", label: `All (${counts.all})` },
            { id: "today", label: `Due Today (${counts.today})` },
            { id: "overdue", label: `Overdue (${counts.overdue})` },
          ] as { id: FilterId; label: string }[]
        ).map((t) => (
          <button key={t.id} type="button" className={`filter-tab ${filter === t.id ? "active" : ""}`.trim()} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
        <Select
          value={project}
          onChange={setProject}
          ariaLabel="Filter by project"
          options={[{ value: "all", label: "Project" }, ...projectOptions]}
        />
      </div>

      {rows === null && !loadError ? (
        <LoadingBlock rows={6} />
      ) : loadError ? (
        <ErrorBlock message={loadError} onRetry={() => void load()} />
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No tasks match this view" body="Try a different filter, or create a new task." />
          ) : (
            <DataTable columns={columns} rows={filtered} keyOf={(r) => r.id} onRowClick={(r) => setOpenTask(r)} />
          )}
        </div>
      )}

      {/* Task detail drawer */}
      {openTask ? (
        <TaskDrawer
          task={openTask}
          projectName={openTask.project}
          onClose={() => setOpenTask(null)}
          onChange={(t) => {
            applyRow(t);
            setOpenTask(t);
          }}
          onUpdate={(t, patch) => updateStatus(t.id, patch.status as TaskStatus, patch.done)}
          onToggleDone={() => void toggleDone(openTask.id, !openTask.done)}
        />
      ) : null}

      {/* New task modal */}
      <Modal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} title="New Task" width={460}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label htmlFor="nt-title">Task Name</label>
            <input id="nt-title" className="field-input" placeholder="What needs to be done?" value={np.title} onChange={(e) => setNp({ ...np, title: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field">
              <label htmlFor="nt-project">Project</label>
              <Select
                size="md"
                value={np.projectId}
                onChange={(v) => setNp({ ...np, projectId: v })}
                options={projectOptions}
                ariaLabel="Project"
              />
            </div>
            <div className="field">
              <label htmlFor="nt-priority">Priority</label>
              <Select size="md" value={np.priority} onChange={(v) => setNp({ ...np, priority: v as TaskRow["priority"] })} options={[{ value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }]} ariaLabel="Priority" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="nt-due">Due Date</label>
            <input id="nt-due" type="date" className="field-input" value={np.due} onChange={(e) => setNp({ ...np, due: e.target.value })} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const title = (np.title || "Untitled task").trim();
                if (!np.projectId) {
                  push("Pick a project for the task", "error");
                  return;
                }
                try {
                  const row = await tasksApi.create({
                    title,
                    project: np.projectId,
                    priority: np.priority.toLowerCase(),
                    dueDate: np.due ? new Date(np.due).toISOString() : null,
                  });
                  setRows((prev) => [row, ...(prev ?? [])]);
                  setNewTaskOpen(false);
                  setNp({ title: "", projectId: np.projectId, priority: "Medium", due: "" });
                  push("Task created", "success");
                } catch (e) {
                  push(errorMessage(e), "error");
                }
              }}
            >
              Create Task
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/* ---- Task detail drawer (Employee board 23) ---- */
function TaskDrawer({
  task,
  projectName,
  onClose,
  onChange,
  onUpdate,
  onToggleDone,
}: {
  task: TaskRow;
  projectName: string;
  onClose: () => void;
  onChange: (t: TaskRow) => void;
  onUpdate: (t: TaskRow, patch: { status: TaskStatus; done: boolean }) => void;
  onToggleDone: () => void;
}) {
  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: "To Do", label: "To Do" },
    { value: "In Progress", label: "In Progress" },
    { value: "In Review", label: "In Review" },
    { value: "Done", label: "Done" },
  ];
  const [statusValue, setStatusValue] = useState<TaskStatus>(task.status);

  const commitStatus = (next: TaskStatus) => {
    setStatusValue(next);
    const done = next === "Done";
    onChange({ ...task, status: next, done });
    onUpdate({ ...task, status: next, done }, { status: next, done });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      subtitle={`${projectName} / ${task.status}`}
      title={task.title}
      footer={
        <>
          <Button variant="danger-soft" onClick={onToggleDone}>{task.done ? "Reopen" : "Mark Complete"}</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label htmlFor="td-status">Status</label>
            <Select size="md" value={statusValue} onChange={(v) => commitStatus(v as TaskStatus)} options={statusOptions} ariaLabel="Status" />
          </div>
          <div className="field">
            <label>Priority</label>
            <Select size="md" value={task.priority} onChange={(v) => onUpdate({ ...task, priority: v as TaskRow["priority"] }, { status: task.status, done: task.done })} options={[{ value: "High", label: "High" }, { value: "Medium", label: "Medium" }, { value: "Low", label: "Low" }]} ariaLabel="Priority" />
          </div>
        </div>

        <div className="field">
          <label>Due</label>
          <input className="field-input" defaultValue={task.due === "—" ? "" : task.due} aria-label="Due date" />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea className="field-input" defaultValue={task.title + " — add details here."} aria-label="Description" />
        </div>

        <div className="field">
          <label>Activity</label>
          <div className="act-list">
            <li>
              <span className="avatar avatar--sm" style={{ background: "#2E86AB" }}>SJ</span>
              <span className="txt">
                <strong>Sarah</strong> commented 2h ago — "This is looking good, see the board for feedback."
              </span>
            </li>
            <li>
              <span className="avatar avatar--sm" style={{ background: "#1F3C88" }}>JC</span>
              <span className="txt">
                <strong>You</strong> updated the task yesterday.
              </span>
            </li>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
