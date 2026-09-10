import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, History, LifeBuoy, Plus, Server, ShieldAlert } from "lucide-react";
import { platformApi, type PlatformTicket } from "../api/platform";
import { LoadingBlock, ErrorBlock } from "../components/ui/Async";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { PageHead, SectionCard } from "../leader/widgets";
import { useToasts } from "../lib/AppProviders";
import { CategoryBadge, Pkpi, TicketPriorityBadge, TicketStatusBadge } from "./ui";

/* ---------------------------------- Audit ---------------------------------- */

export function AuditPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.audit>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.audit({ search, category, page, limit: 25 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    }
  }, [search, category, page]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead title="Audit Logs" subtitle="Every administrative action across companies, subscriptions and security — immutable trail." />

      <SectionCard title="Platform audit trail" action={<span className="ldr-count">{data?.pagination.total ?? "…"} entries</span>}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="field-input" style={{ maxWidth: 280 }} placeholder="Search actor, action, target…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select ariaLabel="Filter by category" value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: "", label: "All categories" }, { value: "company", label: "Company" }, { value: "subscription", label: "Subscription" }, { value: "billing", label: "Billing" }, { value: "security", label: "Security" }, { value: "support", label: "Support" }, { value: "system", label: "System" }]} />
        </div>
        {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
        {!data && !error ? <LoadingBlock rows={8} /> : null}
        {data && data.items.length === 0 ? <EmptyState icon={History} title="No audit entries" body="Nothing matches those filters." /> : null}
        {data && data.items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>When</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Category</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a, i) => (
                  <tr key={a.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td><span className="cell-muted">{a.createdLabel}</span></td>
                    <td><strong className="cell-strong">{a.action}</strong>{a.targetName ? <span className="cell-muted"> · {a.targetName}</span> : null}</td>
                    <td><span className="cell-muted">{a.detail || "—"}</span></td>
                    <td><CategoryBadge category={a.category} /></td>
                    <td><span className="cell-muted">{a.actor}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && data.pagination.pages > 1 ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, alignItems: "center" }}>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="cell-muted">Page {page} of {data.pagination.pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}
      </SectionCard>
    </section>
  );
}

/* ---------------------------------- Tickets ---------------------------------- */

function TicketForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ companyName: "", subject: "", description: "", priority: "medium", reporter: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await platformApi.createTicket(form);
      push("Ticket created", "success");
      onDone();
    } catch (err) {
      push(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="modal-body form-stack">
      <div className="field">
        <label htmlFor="tk-company">Company</label>
        <input id="tk-company" className="field-input" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Acme Labs (leave blank for platform-wide)" />
      </div>
      <div className="field">
        <label htmlFor="tk-subject">Subject *</label>
        <input id="tk-subject" className="field-input" required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="SSO sync failures" />
      </div>
      <div className="field">
        <label htmlFor="tk-desc">Description</label>
        <textarea id="tk-desc" className="field-input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="field">
        <label>Priority</label>
        <Select ariaLabel="Priority" value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }]} size="md" />
      </div>
      <div className="field">
        <label htmlFor="tk-reporter">Reported by</label>
        <input id="tk-reporter" className="field-input" value={form.reporter} onChange={(e) => setForm((f) => ({ ...f, reporter: e.target.value }))} placeholder="Client contact name" />
      </div>
      <div className="modal-foot">
        <Button variant="ghost" size="md" onClick={onCancel} type="button">Cancel</Button>
        <Button variant="primary" size="md" type="submit" disabled={busy}>{busy ? "Saving…" : "Create ticket"}</Button>
      </div>
    </form>
  );
}

export function SupportTicketsPage() {
  const { push } = useToasts();
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.tickets>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.tickets({ status, priority, search, page, limit: 20 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    }
  }, [status, priority, search, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const transition = async (t: PlatformTicket, next: string) => {
    try {
      await platformApi.updateTicket(t.id, { status: next });
      push(`Ticket ${next.replace("_", " ")}`, "success");
      void load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  return (
    <section className="page">
      <PageHead
        title="Support & Tickets"
        subtitle="Customer-reported issues across the platform — triage, assign and resolve."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> New ticket
          </Button>
        }
      />
      {data ? (
        <div className="ldr-kpis">
          <Pkpi icon={LifeBuoy} label="Open" value={String(data.summary.open)} note="open or in progress" />
          <Pkpi icon={ShieldAlert} label="Critical" value={String(data.summary.critical)} note="needs immediate action" />
          <Pkpi icon={Activity} label="Resolved" value={String(data.summary.resolved)} note="closed or resolved" />
        </div>
      ) : null}

      <SectionCard title="Tickets">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="field-input" style={{ maxWidth: 260 }} placeholder="Search subject, company…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select ariaLabel="Filter by status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All statuses" }, { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }]} />
          <Select ariaLabel="Filter by priority" value={priority} onChange={(v) => { setPriority(v); setPage(1); }} options={[{ value: "", label: "All priorities" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }]} />
        </div>
        {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
        {!data && !error ? <LoadingBlock rows={6} /> : null}
        {data && data.items.length === 0 ? <EmptyState icon={LifeBuoy} title="No tickets match" body="Adjust the filters or open a new ticket." /> : null}
        {data && data.items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Company</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reporter</th>
                  <th>Updated</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td>
                      <strong className="cell-strong">{t.subject}</strong>
                      <br />
                      <span className="cell-muted">{t.description.slice(0, 60) || "—"}</span>
                    </td>
                    <td><span className="cell-muted">{t.companyName || "—"}</span></td>
                    <td><TicketPriorityBadge priority={t.priority} /></td>
                    <td><TicketStatusBadge status={t.status} /></td>
                    <td><span className="cell-muted">{t.reporter || "—"}</span></td>
                    <td><span className="cell-muted">{t.updatedLabel}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Select
                          ariaLabel={`Status for ${t.subject}`}
                          value={t.status}
                          onChange={(v) => void transition(t, v)}
                          options={[{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && data.pagination.pages > 1 ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, alignItems: "center" }}>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="cell-muted">Page {page} of {data.pagination.pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        ) : null}
      </SectionCard>

      <Modal open={creating} onClose={() => setCreating(false)} title="New support ticket" width={520}>
        <TicketForm onCancel={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
      </Modal>
    </section>
  );
}

/* ---------------------------------- System health ---------------------------------- */

export function SystemHealthPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.health>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.health());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load system health");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock rows={6} />;

  const statusDot = (s: string) => (s === "Operational" ? "#16a34a" : s === "Degraded" ? "#b45309" : "#dc2626");

  return (
    <section className="page">
      <PageHead title="System Health" subtitle={`Live platform status — checked ${new Date(data.checkedAt).toLocaleTimeString()}`} />

      <div className="ldr-kpis">
        <Pkpi icon={Server} label="Incidents" value={String(data.incidents)} note={data.incidents ? "critical tickets open" : "all clear"} />
        <Pkpi icon={ShieldAlert} label="Companies" value={String(data.storage.companies)} note="tenant records" />
        <Pkpi icon={Activity} label="Users" value={String(data.storage.users)} note={`${data.storage.activeUsers} active`} />
      </div>

      <SectionCard title="Services">
        <div className="ldr-dept-grid">
          {data.services.map((s) => (
            <section className="card ldr-section" key={s.name} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>{s.name}</h3>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: statusDot(s.status), fontWeight: 600, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(s.status), display: "inline-block" }} />
                  {s.status}
                </span>
              </div>
              <p className="cell-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>{s.detail}</p>
              <span className="badge badge--success" style={{ marginTop: 10 }}>{s.latency}</span>
            </section>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Storage counts">
        <div className="ldr-dept-grid">
          {[
            ["Users", data.storage.users],
            ["Active users", data.storage.activeUsers],
            ["Departments", data.storage.departments],
            ["Projects", data.storage.projects],
            ["Tasks", data.storage.tasks],
            ["Tenant companies", data.storage.companies],
            ["Support tickets", data.storage.tickets],
            ["Audit entries", data.storage.auditEntries],
          ].map(([k, v]) => (
            <section className="card ldr-section" key={String(k)} style={{ minWidth: 0 }}>
              <span className="cell-muted" style={{ fontSize: 11, display: "block" }}>{k}</span>
              <strong className="ldr-num" style={{ fontSize: 20 }}>{v}</strong>
            </section>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}
