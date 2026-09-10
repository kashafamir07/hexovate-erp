import { useCallback, useEffect, useState } from "react";
import { Download, PencilLine, Search } from "lucide-react";
import { hrApi, type PerfReviewItem } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { isOrgKind, type RoleConfig } from "../nav";
import { DistBars, LineChart, PageHead, PersonCell, SectionCard, StatusBadge } from "../widgets";
import { downloadCsv } from "../util";

export function LeaderPerformancePage({ cfg }: { cfg: RoleConfig }) {
  const { push } = useToasts();
  const canEdit = cfg.canEditPerformance;
  const [items, setItems] = useState<PerfReviewItem[] | null>(null);
  const [overview, setOverview] = useState<{ avg: number | null; distribution: { label: string; value: number }[]; trend: { period: string; avg: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PerfReviewItem | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (status !== "all") params.status = status;
      if (q) params.search = q;
      const data = await hrApi.performance(params);
      setItems(data.items);
      setOverview(data.overview);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [status, q]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!items || !overview) return <LoadingBlock rows={5} />;

  return (
    <section className="page">
      <PageHead
        title={isOrgKind(cfg.kind) ? "Performance" : "Performance Management"}
        subtitle={`${isOrgKind(cfg.kind) ? "Company-wide review scores and cycles" : "Performance reviews for your team"}`}
        actions={
          <Button variant="white" size="sm" onClick={() => downloadCsv("performance", ["Employee", "Department", "Period", "Score", "Rating", "Status", "Reviewer"], items.map((r) => [r.person.name, r.person.departmentName || "", r.periodLabel, r.score ?? "", r.rating, r.status, r.reviewer]))}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export
          </Button>
        }
      />

      <div className="ldr-kpis">
        <MiniStat label="Average score" value={overview.avg != null ? String(overview.avg) : "—"} />
        <MiniStat label="Reviews shown" value={String(items.length)} />
        <MiniStat label="Open (draft / in review)" value={String(items.filter((i) => i.status !== "completed").length)} />
        <MiniStat label="Completed cycles" value={String(items.filter((i) => i.status === "completed").length)} />
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="Performance Distribution">
            <DistBars points={overview.distribution} />
          </SectionCard>
          {overview.trend.length > 1 ? (
            <SectionCard title="Average Score by Period">
              <LineChart points={overview.trend.map((t) => ({ label: t.period, value: t.avg }))} height={130} />
            </SectionCard>
          ) : null}
        </div>

        <div className="ldr-col ldr-cols--3" style={{ gridTemplateColumns: "1fr" }}>
          <SectionCard
            title="Reviews"
            action={
              <div className="ldr-toolbar" style={{ margin: 0 }}>
                <span className="search-input" style={{ maxWidth: 220 }}>
                  <Search aria-hidden="true" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find employee…" aria-label="Search performance reviews" />
                </span>
                <Select ariaLabel="Review status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "in_review", label: "In review" }, { value: "draft", label: "Draft" }]} />
              </div>
            }
          >
            {items.length === 0 ? (
              <EmptyState icon={PencilLine} title="No reviews found" body="Try a different status or search term." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Period</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Review date</th>
                      {canEdit ? <th style={{ textAlign: "right" }}>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 1 ? "striped" : ""} style={{ cursor: "pointer" }} onClick={() => setEditing(r)}>
                        <td><PersonCell person={r.person} /></td>
                        <td><span className="cell-muted ldr-nowrap">{r.periodLabel}</span></td>
                        <td>{r.score != null && r.score > 0 ? <strong className="ldr-num">{r.score}</strong> : <span className="cell-muted">—</span>}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>{r.reviewDate ? new Date(r.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                        {canEdit ? (
                          <td className="ldr-table-actions">
                            <Button variant="soft" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                              <PencilLine aria-hidden="true" style={{ width: 13, height: 13 }} /> Review
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <ReviewModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        review={editing}
        canEdit={canEdit}
        roleLabel={cfg.label}
        onSaved={() => { setEditing(null); void reload(); }}
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

function ReviewModal({ open, onClose, review, canEdit, roleLabel, onSaved }: { open: boolean; onClose: () => void; review: PerfReviewItem | null; canEdit: boolean; roleLabel: string; onSaved: () => void }) {
  const { push } = useToasts();
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState("in_review");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!review) return;
    setScore(review.score != null && review.score > 0 ? String(review.score) : "");
    setFeedback(review.feedback || "");
    setStatus(review.status || "in_review");
  }, [review]);

  const save = async () => {
    if (!review) return;
    if (score !== "" && (Number(score) < 0 || Number(score) > 100)) {
      push("Score must be between 0 and 100", "error");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { status };
      if (score !== "") body.score = Number(score);
      if (feedback.trim()) body.feedback = feedback.trim();
      await hrApi.updatePerformance(review.id, body);
      push("Review updated", "success");
      onSaved();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={review ? `Review — ${review.person.name}` : "Review"} width={620}>
      {review ? (
        <div className="ldr-stack">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <PersonCell person={review.person} sub={`${review.periodLabel}${review.reviewer ? ` · reviewer: ${review.reviewer}` : ""}`} />
            <StatusBadge status={review.status} />
          </div>

          {review.goals.length > 0 ? (
            <div>
              <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Goals</h4>
              <ul className="ldr-alerts" style={{ gap: 4 }}>
                {review.goals.map((g, i) => (
                  <li key={i} className="ldr-goal-row"><span className="cell-muted">{i + 1}.</span>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ldr-cols--3" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div className="field">
              <label htmlFor="pv-score">Score (0–100)</label>
              <input id="pv-score" className="field-input" type="number" min={0} max={100} value={score} disabled={!canEdit} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-status">Status</label>
              {canEdit ? (
                <Select ariaLabel="Review status" value={status} onChange={setStatus} size="md" options={[{ value: "draft", label: "Draft" }, { value: "in_review", label: "In review" }, { value: "completed", label: "Completed" }]} />
              ) : (
                <input id="pv-status" className="field-input" value={status} disabled />
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="pv-feedback">Feedback</label>
            <textarea id="pv-feedback" className="field-input" rows={4} disabled={!canEdit} placeholder="Notes on progress, strengths, areas to grow…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>

          {canEdit ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="white" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save review"}</Button>
            </div>
          ) : (
            <p className="cell-muted" style={{ margin: 0 }}>{roleLabel} access is read-only — reviews are completed by managers and department heads.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
