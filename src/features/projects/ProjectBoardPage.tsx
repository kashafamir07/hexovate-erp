import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { projectsApi, type ProjectBoard } from "../../api/projects";

/** Kanban board for a project (Employee board 21) — columns from the API. */
export function ProjectBoardPage() {
  const { projectId = "" } = useParams();
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.board(projectId);
      setBoard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Board not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <section className="page">
        <LoadingBlock rows={5} />
      </section>
    );
  }
  if (error || !board) {
    return (
      <section className="page">
        <div className="page-head"><h1>Board</h1></div>
        <ErrorBlock message={error || "Board not found"} onRetry={() => void load()} />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>{board.project.name}</h1>
        <div className="page-head-actions">
          <Button>
            <Plus aria-hidden="true" />
            Add Task
          </Button>
        </div>
      </div>
      <p className="page-subhead sub">Board</p>

      <div className="kanban-scroll">
        <div className="kanban-board">
          {board.columns.map((col) => (
            <div className="kanban-col" key={col.status}>
              <div className="kanban-col-head">
                <h3>{col.status}</h3>
                <span className="count-pill">{board.columnCount[col.status] ?? col.tasks.length}</span>
              </div>
              {col.tasks.map((t) => (
                <div key={t.id} className="board-task" style={{ "--bar": t.accent } as CSSProperties}>
                  <span className="t">{t.title}</span>
                  <span className="tag">{t.tag}</span>
                  <div className="t-row">
                    <span className="due">{t.due}</span>
                    <span className="avatar" style={{ background: t.color }}>{t.initials}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
