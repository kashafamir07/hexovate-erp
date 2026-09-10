import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Download, Search, X } from "lucide-react";
import { hrApi, type LeaveRow } from "../../api/hr";
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
import { downloadCsv } from "../util";

interface Props {
  cfg: RoleConfig;
  includeAll?: boolean; // approvals hub (all request kinds) vs leave-only
  title?: string;
  defaultStatus?: string;
}

export function LeaderLeavesPage({ cfg, includeAll = false, title, defaultStatus }: Props) {
  const { push } = useToasts();
  const canDecide = cfg.canDecide;
  const [items, setItems] = useState<LeaveRow[] | null>(null);
  const [summary, setSummary] = useState<{ pending: number; daysThisMonth: number; onLeaveNow: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(defaultStatus ?? "all");
  const [employee, setEmployee] = useState("");
  const [kind, setKind] = useState(includeAll ? "all" : "leave");
  const [acting, setActing] = useState<LeaveRow | null>(null);
  const [note, setNote] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = { includeAll: includeAll ? "1" : "", type: includeAll ? "" : "leave" };
      if (status !== "all") params.status = status;
      if (employee) params.employee = employee;
      if (q) params.search = q;
      const data = await hrApi.leaves(params);
      setItems(data.items);
      setSummary(data.summary);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [includeAll, status, employee, q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items || []) if (it.requester) seen.set(it.requester.id, it.requester.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const decide = async (decision: "approve" | "reject") => {
    if (!acting) return;
    try {
      await hrApi.decideRequest(acting.id, decision, note.trim());
      push(decision === "approve" ? "Request approved" : "Request rejected", "success");
      setActing(null);
      setNote("");
      void reload();
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!items || !summary) return <LoadingBlock rows={5} />;

  const pageTitle = title ?? (includeAll ? "Approvals" : isOrgKind(cfg.kind) ? "Leave Management" : "Leave Requests");

  return (
    <section className="page">
      <PageHead
        title={pageTitle}
        subtitle={includeAll ? "Requests from people in your scope awaiting decisions and history" : `${isOrgKind(cfg.kind) ? "Company leave across the organization" : "Leave requests from your team"} — review, approve or reject`}
        actions={
          <Button variant="white" size="sm" onClick={() => downloadCsv(pageTitle.toLowerCase().replace(/\s+/g, "-"), ["Employee", "Type", "Dates", "Days", "Status", "Submitted"], (items || []).map((r) => [r.requester?.name || "", r.kind, `${r.startLabel} – ${r.endLabel}`, r.days ?? "", r.statusLabel, r.submittedLabel]))}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export
          </Button>
        }
      />

      <div className="ldr-kpis">
        <MiniStat label="Pending" value={String(summary.pending)} />
        <MiniStat label="Days used (30d)" value={String(summary.daysThisMonth)} />
        <MiniStat label="On leave now" value={String(summary.onLeaveNow)} />
        <MiniStat label="Total records" value={String(summary.total)} />
      </div>

      <SectionCard>
        <div className="ldr-toolbar" style={{ marginBottom: 10 }}>
          <span className="search-input">
            <Search aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests…" aria-label="Search leave requests" />
          </span>
          <Select ariaLabel="Status filter" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }]} />
          {includeAll ? (
            <Select ariaLabel="Type filter" value={kind} onChange={setKind} options={[{ value: "all", label: "All types" }, { value: "leave", label: "Leave" }, { value: "expense", label: "Expense" }, { value: "equipment", label: "Equipment" }, { value: "permission", label: "Permission" }]} />
          ) : null}
          <Select ariaLabel="Employee filter" value={employee} onChange={setEmployee} options={[{ value: "", label: "All employees" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          <span className="ldr-spacer" />
          <span className="ldr-count">{items.length} shown</span>
        </div>

        {items.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No requests here" body="Nothing matches these filters — try widening the status." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {isOrgKind(cfg.kind) ? <th>Department</th> : null}
                  <th>Type</th>
                  <th>Details</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td>{r.requester ? <PersonCell person={r.requester} /> : <span className="cell-muted">—</span>}</td>
                    {isOrgKind(cfg.kind) ? <td><span className="cell-muted">{r.requester?.departmentName || "—"}</span></td> : null}
                    <td><Badge tone="violet">{r.kind}</Badge></td>
                    <td>
                      <strong className="cell-strong">{r.title}</strong>
                      <br />
                      <span className="cell-muted">{r.description || ""}</span>
                    </td>
                    <td className="ldr-nowrap"><span className="cell-muted">{r.startLabel} – {r.endLabel}</span></td>
                    <td>{r.days ?? "—"}</td>
                    <td><StatusBadge status={r.statusLabel} /></td>
                    <td className="ldr-table-actions">
                      {canDecide && r.status === "pending" ? (
                        <>
                          <Button variant="soft" size="sm" onClick={() => { setActing(r); setNote(""); }}>
                            <Check aria-hidden="true" style={{ width: 13, height: 13 }} /> Approve
                          </Button>
                          <Button variant="danger-soft" size="sm" onClick={() => { setActing(r); setNote(""); }}>
                            <X aria-hidden="true" style={{ width: 13, height: 13 }} /> Reject
                          </Button>
                        </>
                      ) : (
                        <span className="cell-muted">{r.reviewer ? `by ${r.reviewer}` : ""}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={Boolean(acting)} onClose={() => setActing(null)} title={acting ? `${acting.status === "pending" ? "Review" : "Request"} — ${acting.title}` : ""} width={520}>
        {acting ? (
          <div className="ldr-stack">
            {acting.requester ? <PersonCell person={acting.requester} /> : null}
            <p className="cell-muted" style={{ margin: 0 }}>
              {acting.kind} · {acting.startLabel} – {acting.endLabel} ({acting.days ?? "—"} days) · submitted {acting.submittedLabel}
            </p>
            {acting.description ? <p style={{ margin: 0, fontSize: 13 }}>{acting.description}</p> : null}
            <div className="field">
              <label htmlFor="rev-note">Note / reason {acting.status === "pending" ? "(add a reason)" : ""}</label>
              <textarea id="rev-note" className="field-input" rows={3} placeholder="e.g. Approved — enjoy the time off, or: Please re-submit with more notice." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="white" onClick={() => setActing(null)}>Cancel</Button>
              <Button variant="soft" onClick={() => void decide("approve")}>
                <Check aria-hidden="true" style={{ width: 14, height: 14 }} /> Approve
              </Button>
              <Button variant="danger-soft" onClick={() => void decide("reject")}>
                <X aria-hidden="true" style={{ width: 14, height: 14 }} /> Reject
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function LeaderApprovalsPage({ cfg }: { cfg: RoleConfig }) {
  return <LeaderLeavesPage cfg={cfg} includeAll title="Approvals" defaultStatus="pending" />;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card ldr-kpi">
      <span className="ldr-kpi-label">{label}</span>
      <span className="ldr-kpi-value" style={{ fontSize: 22 }}>{value}</span>
    </div>
  );
}
