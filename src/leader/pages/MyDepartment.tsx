import { useCallback, useEffect, useState } from "react";
import { Activity, Check, Plus, Target, X } from "lucide-react";
import { hrApi } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import type { RoleConfig } from "../nav";
import { PageHead, PersonCell, SectionCard, ScorePill } from "../widgets";

type DeptDetail = {
  id: string; name: string; description: string; goals: string[];
  head: { name: string; jobTitle: string; email: string } | null;
  stats: Record<string, number | null>;
  people: { id: string; name: string; initials: string; color: string; jobTitle?: string; score: number | null; onLeave: boolean }[];
  recentActivity: { id: string; type: string; text: string; meta: string; status?: string }[];
};

export function MyDepartmentPage(_: { cfg: RoleConfig }) {
  const { push } = useToasts();
  const [dept, setDept] = useState<DeptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editGoals, setEditGoals] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDept(await hrApi.myDepartment());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!dept) return <LoadingBlock rows={6} />;

  return (
    <section className="page">
      <PageHead
        title={dept.name}
        subtitle={dept.description || `${dept.name} department overview`}
        actions={
          <Button variant="white" size="sm" onClick={() => setEditGoals(true)}>
            <Target aria-hidden="true" style={{ width: 14, height: 14 }} /> Manage goals
          </Button>
        }
      />

      <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        <Stat label="Department head" value={dept.head?.name || "—"} sub={dept.head?.jobTitle} />
        <Stat label="Total employees" value={String(dept.stats.total ?? 0)} />
        <Stat label="Attendance today" value={dept.stats.attendanceToday != null ? `${dept.stats.attendanceToday}%` : "—"} sub={`${dept.stats.present ?? 0} present · ${dept.stats.absent ?? 0} absent`} />
        <Stat label="On leave today" value={String(dept.stats.onLeave ?? 0)} />
        <Stat label="Avg performance" value={dept.stats.avgPerformance != null ? String(dept.stats.avgPerformance) : "—"} />
        <Stat label="Open tasks" value={String(dept.stats.openTasks ?? 0)} />
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="People" action={<span className="ldr-count">{dept.people.length} employees</span>}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Today</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {dept.people.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 1 ? "striped" : ""}>
                      <td><PersonCell person={p} /></td>
                      <td>{p.onLeave ? <span className="badge badge--violet">On leave</span> : <span className="badge badge--success">Active</span>}</td>
                      <td><ScorePill score={p.score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="ldr-col">
          <SectionCard title="Department goals">
            {dept.goals.length === 0 ? (
              <p className="cell-muted">No goals defined yet — add goals for this quarter.</p>
            ) : (
              <ul className="ldr-alerts" style={{ gap: 8 }}>
                {dept.goals.map((g, i) => (
                  <li key={i} className="ldr-goal-row">
                    <Target aria-hidden="true" />
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent activity">
            {dept.recentActivity.length === 0 ? (
              <p className="cell-muted">No recent activity to show.</p>
            ) : (
              <ul className="ldr-alerts" style={{ gap: 6 }}>
                {dept.recentActivity.map((a) => (
                  <li key={a.id} className="ldr-alert ldr-alert--info" style={{ padding: "8px 10px" }}>
                    <span className="ldr-alert-icon"><Activity aria-hidden="true" /></span>
                    <span>
                      <strong>{a.text}</strong>
                      <br />
                      <span className="ldr-alert-body">{a.meta}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <GoalsModal open={editGoals} onClose={() => setEditGoals(false)} goals={dept.goals} deptId={dept.id} onSaved={() => { setEditGoals(false); void load(); }} />
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <section className="card ldr-kpi">
      <div className="ldr-kpi-body">
        <span className="ldr-kpi-label">{label}</span>
        <span className="ldr-kpi-value" style={{ fontSize: 20 }}>{value}</span>
        {sub ? <span className="ldr-kpi-note">{sub}</span> : null}
      </div>
    </section>
  );
}

function GoalsModal({ open, onClose, goals, deptId, onSaved }: { open: boolean; onClose: () => void; goals: string[]; deptId: string; onSaved: () => void }) {
  const { push } = useToasts();
  const [list, setList] = useState<string[]>(goals.length ? goals : [""]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setList(goals.length ? goals : [""]);
  }, [open, goals]);

  const save = async () => {
    setBusy(true);
    try {
      await hrApi.patchMyDepartment({ goals: list.filter((g) => g.trim()) });
      push("Department goals updated", "success");
      onSaved();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Department goals" width={540}>
      <div className="ldr-stack">
        <p className="cell-muted" style={{ margin: 0 }}>Goals for this quarter. Add, edit or remove below.</p>
        {list.map((g, i) => (
          <div key={i} className="ldr-goal-row">
            <span className="field-input" style={{ display: "flex", alignItems: "center", gap: 8, padding: 0, border: "none", background: "transparent" }}>
              <input
                className="field-input"
                style={{ flex: 1 }}
                value={g}
                placeholder={`Goal ${i + 1}`}
                aria-label={`Goal ${i + 1}`}
                onChange={(e) => setList((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </span>
            <button type="button" className="icon-btn-flat" aria-label={`Remove goal ${i + 1}`} onClick={() => setList((prev) => prev.filter((_, j) => j !== i))}>
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <Button variant="soft" size="sm" onClick={() => setList((prev) => [...prev, ""])}>
            <Plus aria-hidden="true" style={{ width: 13, height: 13 }} /> Add goal
          </Button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="white" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>
            <Check aria-hidden="true" style={{ width: 14, height: 14 }} /> Save goals
          </Button>
        </div>
      </div>
    </Modal>
  );
}
