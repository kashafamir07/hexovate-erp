import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronDown, Receipt, FolderOpen } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useClickOutside } from "../../lib/useClickOutside";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { requestsApi } from "../../api/requests";
import { kindTone, statusTone, type RequestRow } from "../../data/requests";

type FilterId = "all" | "Leave" | "Expense" | "PO";

/** My Requests (Employee board 33) with the leave/expense + detail flows. */
export function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newKind, setNewKind] = useState<"leave" | "expense" | null>(null);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const [sp, setSp] = useSearchParams();
  const { push } = useToasts();
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));

  const load = async () => {
    try {
      setLoadError(null);
      const items = await requestsApi.list({ scope: "mine" });
      setRows(items);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const kind = sp.get("new");
    if (kind === "leave" || kind === "expense") {
      setNewKind(kind);
      sp.delete("new");
      setSp(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = rows ?? [];
  const counts = {
    all: list.length,
    Leave: list.filter((r) => r.kind === "Leave").length,
    Expense: list.filter((r) => r.kind === "Expense").length,
    PO: list.filter((r) => r.kind === "Purchase Order").length,
  };

  const visible = list.filter((r) => {
    if (filter === "all") return true;
    if (filter === "PO") return r.kind === "Purchase Order";
    return r.kind === filter;
  });

  const addRequest = async (payload: { type: "leave" | "expense"; title: string; description?: string; startDate?: string | null; endDate?: string | null; amount?: number | null }) => {
    try {
      const row = await requestsApi.create(payload);
      setRows((prev) => [row, ...(prev ?? [])]);
      setNewKind(null);
      push("Request submitted for approval", "success");
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const withdraw = async (id: string) => {
    try {
      const row = await requestsApi.withdraw(id);
      setRows((prev) => (prev ?? []).map((r) => (r.id === id ? row : r)));
      setDetail(null);
      push("Request withdrawn", "success");
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  const columns: Column<RequestRow>[] = [
    {
      id: "type",
      header: "Type",
      render: (r) => <Badge tone={kindTone[r.kind]}>{r.kind}</Badge>,
    },
    { id: "desc", header: "Description", render: (r) => <span className="cell-strong">{r.description}</span> },
    { id: "dates", header: "Dates", render: (r) => <span className="cell-muted">{r.dates}</span> },
    { id: "submitted", header: "Submitted", render: (r) => <span className="cell-muted">{r.submitted}</span> },
    { id: "approver", header: "Approver", render: (r) => <span className="cell-muted">{r.approver}</span> },
    { id: "status", header: "Status", render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
    {
      id: "view",
      render: (r) => <span className="view-link">View</span>,
      className: "col-actions",
    },
  ];

  return (
    <section className="page">
      <div className="page-head">
        <h1>My Requests</h1>
        <div ref={menuRef} style={{ position: "relative" }}>
          <Button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            New Request
            <ChevronDown aria-hidden="true" style={{ width: 15, height: 15 }} />
          </Button>
          {menuOpen ? (
            <div className="menu-card" style={{ left: 0, right: "auto" }}>
              <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); setNewKind("leave"); }}>
                <CalendarDays aria-hidden="true" />
                <span>Leave request</span>
              </button>
              <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); setNewKind("expense"); }}>
                <Receipt aria-hidden="true" />
                <span>Expense request</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="filter-bar">
        {(
          [
            { id: "all", label: `All (${counts.all})` },
            { id: "Leave", label: `Leave (${counts.Leave})` },
            { id: "Expense", label: `Expenses (${counts.Expense})` },
            { id: "PO", label: `Purchase Orders (${counts.PO})` },
          ] as { id: FilterId; label: string }[]
        ).map((t) => (
          <button key={t.id} type="button" className={`filter-text ${filter === t.id ? "active" : ""}`.trim()} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {rows === null && !loadError ? (
        <LoadingBlock rows={4} />
      ) : loadError ? (
        <ErrorBlock message={loadError} onRetry={() => void load()} />
      ) : (
        <div className="card">
          {visible.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No requests here" body="Submit a leave or expense request and it will show up in this list." />
          ) : (
            <DataTable columns={columns} rows={visible} keyOf={(r) => r.id} onRowClick={(r) => setDetail(r)} />
          )}
        </div>
      )}

      {/* New leave / expense */}
      <Modal
        open={newKind !== null}
        onClose={() => setNewKind(null)}
        title={newKind === "leave" ? "Request Leave" : "Submit Expense"}
        width={480}
      >
        {newKind === "leave" ? <LeaveForm onClose={() => setNewKind(null)} onSubmit={addRequest} /> : null}
        {newKind === "expense" ? <ExpenseForm onClose={() => setNewKind(null)} onSubmit={addRequest} /> : null}
      </Modal>

      {/* Request detail drawer */}
      {detail ? <RequestDetailDrawer row={detail} onClose={() => setDetail(null)} onWithdraw={() => void withdraw(detail.id)} /> : null}
    </section>
  );
}

function toDateOrNull(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ---- Leave request form (Employee boards 35/36) ---- */
function LeaveForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (p: { type: "leave"; title: string; description?: string; startDate?: string | null; endDate?: string | null }) => void }) {
  const [leaveType, setLeaveType] = useState("Vacation");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState("Oct 21, 2026");
  const [end, setEnd] = useState("Oct 25, 2026");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="lv-type">Leave Type</label>
        <Select
          size="md"
          value={leaveType}
          onChange={setLeaveType}
          options={[{ value: "Vacation", label: "Vacation" }, { value: "Sick", label: "Sick" }, { value: "Personal", label: "Personal" }]}
          ariaLabel="Leave type"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field">
          <label htmlFor="lv-start">Start Date</label>
          <input id="lv-start" className="field-input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lv-end">End Date</label>
          <input id="lv-end" className="field-input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <p className="field-hint">4 working days · 10 days remaining after this request</p>
      <div className="field">
        <label htmlFor="lv-notes">Notes</label>
        <textarea id="lv-notes" className="field-input" placeholder="Add context for your manager (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() =>
            onSubmit({
              type: "leave",
              title: `${leaveType} — ${notes || "New request"}`,
              description: notes || undefined,
              startDate: toDateOrNull(start),
              endDate: toDateOrNull(end),
            })
          }
        >
          Submit Request
        </Button>
      </div>
    </div>
  );
}

/* ---- Expense request form (boards 37/38) ---- */
function ExpenseForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (p: { type: "expense"; title: string; description?: string; amount?: number | null }) => void }) {
  const [amount, setAmount] = useState("$146.00");
  const [desc, setDesc] = useState("Client dinner with TechNova onboarding team");
  const [date, setDate] = useState("Oct 3, 2026");
  void date;

  const parseAmount = () => {
    const n = Number(String(amount).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? null : n;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="ex-cat">Category</label>
        <Select
          size="md"
          value="Client Entertainment"
          onChange={() => undefined}
          options={[
            { value: "Client Entertainment", label: "Client Entertainment" },
            { value: "Travel", label: "Travel" },
            { value: "Meals", label: "Meals" },
            { value: "Software", label: "Software" },
          ]}
          ariaLabel="Category"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field">
          <label htmlFor="ex-amount">Amount</label>
          <input id="ex-amount" className="field-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ex-date">Date Incurred</label>
          <input id="ex-date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ex-desc">Description</label>
        <textarea id="ex-desc" className="field-input" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="field">
        <label>Receipt</label>
        <button type="button" className="attach-box">Tap to attach receipt</button>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() =>
            onSubmit({
              type: "expense",
              title: desc,
              description: desc,
              amount: parseAmount(),
            })
          }
        >
          Submit Expense
        </Button>
      </div>
    </div>
  );
}

/* ---- Request detail drawer (boards 49/50) ---- */
function RequestDetailDrawer({ row, onClose, onWithdraw }: { row: RequestRow; onClose: () => void; onWithdraw: () => void }) {
  const pending = row.status === "Pending";
  return (
    <Drawer
      open
      onClose={onClose}
      subtitle={row.kind}
      title={row.description}
      footer={
        pending ? (
          <Button variant="danger-soft" onClick={onWithdraw}>
            Withdraw Request
          </Button>
        ) : undefined
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge tone={statusTone[row.status]}>{row.status}</Badge>
          <span className="field-hint">{(row.status === "Pending" ? "4 days" : row.dates) + (row.status === "Pending" ? " in queue" : "")}</span>
        </div>
        <p className="field-hint" style={{ marginTop: -10 }}>
          {row.dates} · Submitted {row.submitted}
        </p>

        <div className="field">
          <label>Approver</label>
          <span style={{ fontSize: 14 }}>{row.approver}</span>
        </div>

        <div className="field">
          <label>Notes</label>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>{row.notes ?? "No notes provided."}</p>
        </div>

        <div className="field">
          <label>Status</label>
          <div className="steps">
            <div className="step done">
              <span className="step-dot" />
              <span className="step-txt">
                <span className="tt">Request submitted</span>
                <span className="st">Submitted {row.submitted}</span>
              </span>
            </div>
            <div className={`step ${pending ? "pending" : "done"}`.trim()}>
              <span className="step-dot" />
              <span className="step-txt">
                <span className="tt">Awaiting manager review</span>
                <span className="st">{pending ? `${row.approver} · in progress` : row.approver}</span>
              </span>
            </div>
            <div className="step pending">
              <span className="step-dot" />
              <span className="step-txt">
                <span className="tt">Final decision</span>
                <span className="st">{row.status === "Approved" ? "Approved" : row.status === "Rejected" ? "Rejected" : "Pending approval"}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
