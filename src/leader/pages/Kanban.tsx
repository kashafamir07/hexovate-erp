import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KanbanSquare, Plus } from "lucide-react";
import { hrApi, type TeamTask } from "../../api/hr";
import { errorMessage } from "../../api/client";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { PageHead, SectionCard } from "../widgets";
import type { RoleConfig } from "../nav";

const STATUS_UI: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "In Review", completed: "Done" };
const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "In Review" },
  { key: "completed", label: "Done" },
];
const PRIORITY_TONE: Record<string, "danger" | "warning" | "success" | "gray"> = { high: "danger", medium: "warning", low: "success" };

export function LeaderKanbanPage({ cfg }: { cfg: RoleConfig }) {
  const navigate = useNavigate();
  const { push } = useToasts();
  const [items, setItems] = useState<TeamTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await hrApi.teamTasks({ limit: "200" });
      setItems(data.items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const move = async (task: TeamTask, next: string) => {
    try {
      await hrApi.updateTask(task.id, { status: next });
      push(next === "completed" ? "Task completed" : `Moved to ${STATUS_UI[next]}`, "success");
      void reload();
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!items) return <LoadingBlock rows={6} />;

  const byStatus = (key: string) => items.filter((t) => t.status === key);

  return (
    <section className="page">
      <PageHead
        title="Kanban Board"
        subtitle="Drag-less board — use the status menu on each card to move work."
        actions={
          <Button size="sm" onClick={() => navigate("/manager/tasks")}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> New task
          </Button>
        }
      />

      {items.length === 0 ? (
        <SectionCard>
          <EmptyState icon={KanbanSquare} title="No tasks yet" body="Assign a task from the Team Tasks page to populate the board." />
        </SectionCard>
      ) : (
        <div className="kanban">
          {COLUMNS.map((col) => {
            const cards = byStatus(col.key);
            return (
              <section className="card kanban-col" key={col.key}>
                <header className="kanban-col-head">
                  <h2>{col.label}</h2>
                  <span className="ldr-count">{cards.length}</span>
                </header>
                <div className="kanban-list">
                  {cards.length === 0 ? <p className="mgr-empty">Empty</p> : null}
                  {cards.map((t) => (
                    <article className="kanban-card" key={t.id}>
                      <div className="kanban-card-top">
                        <strong className="mgr-task-title">{t.title}</strong>
                        <Badge tone={PRIORITY_TONE[t.priorityKey] || "gray"}>{t.priority}</Badge>
                      </div>
                      <span className="mgr-task-meta">{t.project || "No project"}</span>
                      <div className="kanban-card-foot">
                        {t.assignee ? (
                          <span className="person-cell">
                            <Avatar initials={t.assignee.initials} color={t.assignee.color} title={t.assignee.name} />
                            <span className="cell-muted">{t.assignee.name}</span>
                          </span>
                        ) : (
                          <span className="cell-muted">Unassigned</span>
                        )}
                        <span className="cell-muted ldr-nowrap">{t.due}</span>
                      </div>
                      {t.status !== "completed" ? (
                        <Select
                          ariaLabel={`Move ${t.title}`}
                          value={t.status}
                          onChange={(v) => void move(t, v)}
                          size="sm"
                          options={Object.entries(STATUS_UI).map(([value, label]) => ({ value, label }))}
                        />
                      ) : (
                        <span className="ldr-count">Done — <button type="button" className="link-btn" onClick={() => void move(t, "todo")}>reopen</button></span>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}