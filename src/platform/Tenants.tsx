import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Building2, Building2 as B2Icon, CalendarClock, CreditCard, Plus, RefreshCw, Trash2, UserRound, Wallet } from "lucide-react";
import { platformApi, type PlatformCompany } from "../api/platform";
import { LoadingBlock, ErrorBlock } from "../components/ui/Async";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { BarChart as TrendChart, PageHead, SectionCard } from "../leader/widgets";
import { useToasts } from "../lib/AppProviders";
import { CompanyStatusBadge, PlanBadge, Pkpi, toK } from "./ui";

const grid2: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

function CompanyForm({ initial, onDone, onCancel }: { initial: PlatformCompany | null; onDone: () => void; onCancel: () => void }) {
  const { push } = useToasts();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name || "",
    domain: initial?.domain || "",
    industry: initial?.industry || "",
    plan: initial?.plan || "trial",
    status: initial?.status || "trial",
    seats: initial?.seats || 10,
    contactName: initial?.contactName || "",
    contactEmail: initial?.contactEmail || "",
    renewalDate: initial?.renewalDate ? String(initial.renewalDate).slice(0, 10) : "",
    notes: initial?.notes || "",
  });
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (initial) await platformApi.updateCompany(initial.id, { ...form, seats: Number(form.seats) || 1 });
      else await platformApi.createCompany({ ...form, seats: Number(form.seats) || 1 });
      push(initial ? "Company updated" : "Company added", "success");
      onDone();
    } catch (err) {
      push(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="modal-body form-stack">
      <div style={grid2}>
        <div className="field">
          <label htmlFor="cmp-name">Company name *</label>
          <input id="cmp-name" className="field-input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Labs" />
        </div>
        <div className="field">
          <label htmlFor="cmp-domain">Domain</label>
          <input id="cmp-domain" className="field-input" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="acme.com" />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label htmlFor="cmp-industry">Industry</label>
          <input id="cmp-industry" className="field-input" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="SaaS" />
        </div>
        <div className="field">
          <label htmlFor="cmp-seats">Seats</label>
          <input id="cmp-seats" type="number" min={1} className="field-input" value={form.seats} onChange={(e) => set("seats", Number(e.target.value))} />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label>Plan</label>
          <Select ariaLabel="Plan" value={form.plan} onChange={(v) => set("plan", v)} options={[{ value: "trial", label: "Trial" }, { value: "business", label: "Business" }, { value: "enterprise", label: "Enterprise" }]} size="md" />
        </div>
        <div className="field">
          <label>Status</label>
          <Select ariaLabel="Status" value={form.status} onChange={(v) => set("status", v)} options={[{ value: "active", label: "Active" }, { value: "trial", label: "Trial" }, { value: "suspended", label: "Suspended" }]} size="md" />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label htmlFor="cmp-contact">Contact name</label>
          <input id="cmp-contact" className="field-input" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cmp-email">Contact email</label>
          <input id="cmp-email" type="email" className="field-input" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </div>
      </div>
      <div style={grid2}>
        <div className="field">
          <label htmlFor="cmp-renewal">Renewal date</label>
          <input id="cmp-renewal" type="date" className="field-input" value={form.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cmp-notes">Notes</label>
          <input id="cmp-notes" className="field-input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <Button variant="ghost" size="md" onClick={onCancel} type="button">Cancel</Button>
        <Button variant="primary" size="md" type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Add company"}</Button>
      </div>
    </form>
  );
}

export function CompaniesPage() {
  const { push } = useToasts();
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.companies>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PlatformCompany | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlatformCompany | null>(null);

  const load = useCallback(async (pageN = page, extra: Record<string, string> = {}) => {
    setError(null);
    try {
      setData(await platformApi.companies({ search, plan, status, page: pageN, limit: 20, ...extra }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies");
    }
  }, [search, plan, status, page]);
  useEffect(() => {
    void load(page);
  }, [load, page]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await platformApi.deleteCompany(deleting.id);
      push("Company removed", "success");
      setDeleting(null);
      void load(page);
    } catch (e) {
      push(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  return (
    <section className="page">
      <PageHead
        title="Companies"
        subtitle="Every tenant on the Hexovate platform — plans, seats and renewals."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> Add Company
          </Button>
        }
      />

      {data ? (
        <div className="ldr-kpis">
          <Pkpi icon={B2Icon} label="Companies" value={String(data.summary.total)} note={`${data.summary.open} non-suspended`} />
          <Pkpi icon={UserRound} label="Active" value={String(data.summary.active)} note="paid subscriptions" />
          <Pkpi icon={Wallet} label="Monthly revenue" value={`$${Math.round(data.summary.mrr / 100) / 10}K`} note="across plans" />
        </div>
      ) : null}

      <SectionCard title="Company directory">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="field-input" style={{ maxWidth: 260 }} placeholder="Search companies, domains, contacts…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select ariaLabel="Filter by plan" value={plan} onChange={(v) => { setPlan(v); setPage(1); }} options={[{ value: "", label: "All plans" }, { value: "enterprise", label: "Enterprise" }, { value: "business", label: "Business" }, { value: "trial", label: "Trial" }]} />
          <Select ariaLabel="Filter by status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "trial", label: "Trial" }, { value: "suspended", label: "Suspended" }]} />
        </div>

        {error ? <ErrorBlock message={error} onRetry={() => void load(page)} /> : null}
        {!data && !error ? <LoadingBlock rows={6} /> : null}
        {data && data.items.length === 0 ? <EmptyState icon={Building2} title="No companies match" body="Adjust the filters or add a new company." /> : null}

        {data && data.items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Seats</th>
                  <th>MRR</th>
                  <th>Renewal</th>
                  <th>Added</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 1 ? "striped" : ""}>
                    <td>
                      <strong className="cell-strong">{c.name}</strong>
                      <br />
                      <span className="cell-muted">{c.domain || "—"} · {c.contactName || "no contact"}</span>
                    </td>
                    <td><span className="cell-muted">{c.industry || "—"}</span></td>
                    <td><PlanBadge plan={c.plan} /></td>
                    <td><CompanyStatusBadge status={c.status} /></td>
                    <td>{c.seatsUsed} / {c.seats}</td>
                    <td><strong className="ldr-num">{c.mrrLabel}</strong></td>
                    <td><span className="cell-muted">{c.renewalLabel}</span></td>
                    <td><span className="cell-muted">{c.createdLabel}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button variant="soft" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                        <button type="button" className="icon-btn-flat" aria-label={`Remove ${c.name}`} onClick={() => setDeleting(c)}>
                          <Trash2 aria-hidden="true" style={{ width: 14, height: 14, color: "#dc2626" }} />
                        </button>
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

      <Modal open={creating} onClose={() => setCreating(false)} title="Add company" width={560}>
        <CompanyForm initial={null} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); void load(1); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} width={560}>
        {editing ? <CompanyForm initial={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); void load(page); }} /> : null}
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Remove company" width={420}>
        <div className="modal-body">
          <p>Remove <strong>{deleting?.name}</strong> from the platform? This also detaches its support tickets. This cannot be undone.</p>
          <div className="modal-foot">
            <Button variant="ghost" size="md" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => void remove()}>Remove company</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

export function SubscriptionsPage() {
  const { push } = useToasts();
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.subscriptions>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.subscriptions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const change = async (id: string, patch: Record<string, unknown>, msg: string) => {
    try {
      await platformApi.updateCompany(id, patch);
      push(msg, "success");
      void load();
    } catch (e) {
      push(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock rows={6} />;

  return (
    <section className="page">
      <PageHead title="Subscriptions & Billing" subtitle="Plan distribution, monthly recurring revenue and renewals across the platform." />

      <div className="ldr-kpis">
        <Pkpi icon={Wallet} label="Monthly recurring revenue" value={`$${Math.round(data.summary.mrr / 100) / 10}K`} note="all active plans" />
        <Pkpi icon={CreditCard} label="Active subscriptions" value={String(data.summary.active)} note={`${data.summary.activeRate}% of companies`} />
        <Pkpi icon={CalendarClock} label="Renewing in 60 days" value={String(data.summary.renewingSoon)} note="needs attention" />
        <Pkpi icon={UserRound} label="Seats" value={`${data.summary.seatsUsed} / ${data.summary.seats}`} note="used / contracted" />
      </div>

      <div className="ldr-dept-grid">
        {data.byPlan.map((p) => (
          <section className="card ldr-section" key={p.plan}>
            <PlanBadge plan={p.plan} />
            <h3 style={{ margin: "10px 0 2px", fontSize: 15 }}>{p.label} plan</h3>
            <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>${p.rate}/month per company</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <span><strong className="ldr-num" style={{ fontSize: 20 }}>{p.count}</strong> <span className="cell-muted">companies</span></span>
              <span><strong className="ldr-num" style={{ fontSize: 20 }}>${Math.round(p.mrr / 100) / 10}K</strong> <span className="cell-muted">MRR</span></span>
            </div>
          </section>
        ))}
      </div>

      <SectionCard title="MRR trend (last 8 months)">
        <TrendChart points={data.mrrTrend.map((m) => ({ label: m.label, value: toK(m.value) }))} unit="K" />
      </SectionCard>

      <SectionCard title="All subscriptions" action={<Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" style={{ width: 13, height: 13 }} /> Refresh</Button>}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Seats</th>
                <th>MRR / mo</th>
                <th>Renewal</th>
                <th style={{ width: 210 }}>Quick actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c, i) => (
                <tr key={c.id} className={i % 2 === 1 ? "striped" : ""}>
                  <td>
                    <strong className="cell-strong">{c.name}</strong>
                    <br />
                    <span className="cell-muted">{c.industry || "—"}</span>
                  </td>
                  <td><PlanBadge plan={c.plan} /></td>
                  <td><CompanyStatusBadge status={c.status} /></td>
                  <td>{c.seatsUsed} / {c.seats}</td>
                  <td><strong className="ldr-num">{c.mrrLabel}</strong></td>
                  <td><span className="cell-muted">{c.renewalLabel}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Select
                        ariaLabel={`Plan for ${c.name}`}
                        value={c.plan}
                        onChange={(v) => void change(c.id, { plan: v }, `${c.name} moved to ${v} plan`)}
                        options={[{ value: "trial", label: "Trial" }, { value: "business", label: "Business" }, { value: "enterprise", label: "Enterprise" }]}
                      />
                      <Select
                        ariaLabel={`Status for ${c.name}`}
                        value={c.status}
                        onChange={(v) => void change(c.id, { status: v }, `${c.name} marked ${v}`)}
                        options={[{ value: "active", label: "Active" }, { value: "trial", label: "Trial" }, { value: "suspended", label: "Suspend" }]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </section>
  );
}


