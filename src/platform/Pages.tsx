import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileText, Plus, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { platformApi, type PlatformInvoice, type RoleTemplateRow, type SuperAdminRow, type SecuritySettings, type IntegrationRow, type UsageRow } from "../api/platform";
import { LoadingBlock, ErrorBlock } from "../components/ui/Async";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { PageHead, SectionCard } from "../leader/widgets";
import { useToasts } from "../lib/AppProviders";
import { errorMessage } from "../api/client";
import { PlanBadge, Pkpi } from "./ui";
import { Building2, CreditCard, LifeBuoy } from "lucide-react";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function statusTone(status: string): "success" | "warning" | "danger" | "gray" {
  if (status === "paid" || status === "active") return "success";
  if (status === "open" || status === "trial") return "warning";
  if (status === "overdue" || status === "suspended" || status === "inactive") return "danger";
  return "gray";
}

/* ---------------- Global Search ---------------- */

export function GlobalSearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.globalSearch>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    setBusy(true);
    const t = window.setTimeout(async () => {
      try {
        setData(await platformApi.globalSearch(q.trim()));
      } catch {
        setData(null);
      } finally {
        setBusy(false);
      }
    }, 260);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <section className="page">
      <PageHead title="Global Search" subtitle="Search companies, people and support tickets across the whole platform." />
      <SectionCard>
        <div className="ldr-toolbar" style={{ marginBottom: 0 }}>
          <span className="search-input" style={{ maxWidth: 420 }}>
            <Search aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything (company, person, ticket)…" aria-label="Global search" autoFocus />
          </span>
          {busy ? <span className="ldr-count">Searching…</span> : null}
        </div>

        {!data && !busy ? (
          <EmptyState icon={Search} title="Type to search" body="Enter at least 2 characters to search companies, people and tickets." />
        ) : null}
        {data ? (
          <>
            <SearchGroup title="Companies" count={data.companies.length}>
              {data.companies.map((c) => (
                <div className="sa-search-row" key={c.id}>
                  <Building2 aria-hidden="true" style={{ width: 15, height: 15, color: "#2563eb" }} />
                  <div>
                    <div className="cell-strong">{c.name}</div>
                    <div className="cell-muted" style={{ fontSize: 12 }}>{c.sub} · {c.plan} · {c.status}</div>
                  </div>
                </div>
              ))}
            </SearchGroup>
            <SearchGroup title="People" count={data.people.length}>
              {data.people.map((p) => (
                <div className="sa-search-row" key={p.id}>
                  <Users aria-hidden="true" style={{ width: 15, height: 15, color: "#2563eb" }} />
                  <div>
                    <div className="cell-strong">{p.name}</div>
                    <div className="cell-muted" style={{ fontSize: 12 }}>{p.sub} · {p.status}</div>
                  </div>
                </div>
              ))}
            </SearchGroup>
            <SearchGroup title="Support tickets" count={data.tickets.length}>
              {data.tickets.map((t) => (
                <div className="sa-search-row" key={t.id}>
                  <LifeBuoy aria-hidden="true" style={{ width: 15, height: 15, color: "#2563eb" }} />
                  <div>
                    <div className="cell-strong">{t.subject}</div>
                    <div className="cell-muted" style={{ fontSize: 12 }}>{t.sub} · {t.priority} · {t.status}</div>
                  </div>
                </div>
              ))}
            </SearchGroup>
          </>
        ) : null}
      </SectionCard>
    </section>
  );
}

function SearchGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "#6b7280" }}>{title} ({count})</h3>
      {children}
    </div>
  );
}

/* ---------------- Role Templates ---------------- */

export function RoleTemplatesPage() {
  const { push } = useToasts();
  const [items, setItems] = useState<RoleTemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permissions: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await platformApi.roleTemplates()).items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await platformApi.createRoleTemplate({
        name: form.name,
        description: form.description,
        permissions: form.permissions.split(",").map((s) => s.trim()).filter(Boolean),
      });
      push("Template created", "success");
      setCreating(false);
      setForm({ name: "", description: "", permissions: "" });
      void load();
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tpl: RoleTemplateRow) => {
    try {
      await platformApi.deleteRoleTemplate(tpl.id);
      push("Template deleted", "success");
      void load();
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  return (
    <section className="page">
      <PageHead
        title="Role Templates"
        subtitle="Reusable permission bundles the platform hands to tenant companies."
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> New template
          </Button>
        }
      />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!items && !error ? <LoadingBlock rows={5} /> : null}
      {items ? (
        <SectionCard title="Templates" action={<span className="ldr-count">{items.length} total</span>}>
          {items.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No templates" body="Create the first role template for tenant companies." />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Description</th>
                    <th>Permissions</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td><strong className="cell-strong">{t.name}</strong></td>
                      <td><span className="cell-muted">{t.description}</span></td>
                      <td>
                        <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {t.permissions.slice(0, 4).map((p) => (
                            <Badge key={p} tone="gray">{p}</Badge>
                          ))}
                          {t.permissions.length > 4 ? <Badge tone="gray">+{t.permissions.length - 4}</Badge> : null}
                        </span>
                      </td>
                      <td><Badge tone={t.system ? "primary" : "gray"}>{t.system ? "System" : "Custom"}</Badge></td>
                      <td>
                        {t.system ? (
                          <span className="cell-muted">—</span>
                        ) : (
                          <button type="button" className="icon-btn-flat" aria-label={`Delete ${t.name}`} onClick={() => void remove(t)}>
                            <Trash2 aria-hidden="true" style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      <Modal open={creating} onClose={() => setCreating(false)} title="New role template">
        <form onSubmit={submit} className="modal-body form-stack">
          <div className="field">
            <label htmlFor="tpl-name">Name *</label>
            <input id="tpl-name" className="field-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Field Operations" />
          </div>
          <div className="field">
            <label htmlFor="tpl-desc">Description</label>
            <input id="tpl-desc" className="field-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this bundle grants" />
          </div>
          <div className="field">
            <label htmlFor="tpl-perms">Permissions (comma-separated)</label>
            <input id="tpl-perms" className="field-input" value={form.permissions} onChange={(e) => setForm((f) => ({ ...f, permissions: e.target.value }))} placeholder="people.org, tasks.assign" />
          </div>
          <div className="modal-foot">
            <Button variant="ghost" size="md" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" size="md" type="submit" disabled={busy}>{busy ? "Creating…" : "Create template"}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ---------------- Super Admins ---------------- */

export function SuperAdminsPage() {
  const { push } = useToasts();
  const [items, setItems] = useState<SuperAdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await platformApi.superAdmins()).items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: SuperAdminRow) => {
    const next = row.status === "active" ? "inactive" : "active";
    try {
      await platformApi.patchSuperAdmin(row.id, { status: next });
      push(`Account ${next === "active" ? "reactivated" : "suspended"}`, "success");
      void load();
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  return (
    <section className="page">
      <PageHead title="Super Admins" subtitle="Platform administrator accounts and their access status." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!items && !error ? <LoadingBlock rows={4} /> : null}
      {items ? (
        <SectionCard title="Platform accounts" action={<span className="ldr-count">{items.length} accounts</span>}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="home-person">
                        <Avatar initials={u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} color="#1d4ed8" title={u.name} className="avatar--sm" />
                        <strong className="cell-strong">{u.name}</strong>
                      </span>
                    </td>
                    <td><span className="cell-muted">{u.email}</span></td>
                    <td><Badge tone={u.role === "super_admin" ? "danger" : "primary"}>{u.roleLabel}</Badge></td>
                    <td><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                    <td><span className="cell-muted">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span></td>
                    <td>
                      <Button variant="white" size="sm" onClick={() => void toggle(u)}>
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}

/* ---------------- Security & Access ---------------- */

export function SecurityAccessPage() {
  const { push } = useToasts();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSettings((await platformApi.security()).settings);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<SecuritySettings>) => {
    setBusy(true);
    try {
      const next = await platformApi.patchSecurity(patch);
      setSettings(next);
      push("Security settings updated", "success");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!settings && !error) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!settings) return null;

  return (
    <section className="page">
      <PageHead title="Security & Access" subtitle="Platform-wide security policy. Changes apply to every tenant immediately." />
      <SectionCard title="Global policy" action={settings.updatedBy ? <span className="ldr-count">Updated by {settings.updatedBy}</span> : undefined}>
        <div className="sa-setting-list">
          <label className="sa-setting">
            <div>
              <div className="cell-strong">Require two-factor authentication</div>
              <div className="cell-muted" style={{ fontSize: 12 }}>All admin accounts must enroll a second factor.</div>
            </div>
            <input type="checkbox" checked={settings.twoFactorRequired} disabled={busy} onChange={(e) => void save({ twoFactorRequired: e.target.checked })} />
          </label>
          <label className="sa-setting">
            <div>
              <div className="cell-strong">Allow new company signups</div>
              <div className="cell-muted" style={{ fontSize: 12 }}>When off, the public signup form is disabled.</div>
            </div>
            <input type="checkbox" checked={settings.allowSignups} disabled={busy} onChange={(e) => void save({ allowSignups: e.target.checked })} />
          </label>
          <label className="sa-setting">
            <div>
              <div className="cell-strong">Maintenance mode</div>
              <div className="cell-muted" style={{ fontSize: 12 }}>Show a maintenance banner across all tenants.</div>
            </div>
            <input type="checkbox" checked={settings.maintenanceMode} disabled={busy} onChange={(e) => void save({ maintenanceMode: e.target.checked })} />
          </label>
          <div className="sa-setting">
            <div>
              <div className="cell-strong">Session timeout</div>
              <div className="cell-muted" style={{ fontSize: 12 }}>Idle minutes before an admin is signed out.</div>
            </div>
            <Select ariaLabel="Session timeout" value={String(settings.sessionTimeoutMin)} onChange={(v) => void save({ sessionTimeoutMin: Number(v) })} size="md" options={["30", "60", "120", "240"].map((v) => ({ value: v, label: `${v} min` }))} />
          </div>
          <div className="sa-setting">
            <div>
              <div className="cell-strong">Minimum password length</div>
              <div className="cell-muted" style={{ fontSize: 12 }}>Applies to all new passwords platform-wide.</div>
            </div>
            <Select ariaLabel="Minimum password length" value={String(settings.passwordMinLength)} onChange={(v) => void save({ passwordMinLength: Number(v) })} size="md" options={["8", "10", "12", "16"].map((v) => ({ value: v, label: `${v} chars` }))} />
          </div>
        </div>
      </SectionCard>
    </section>
  );
}

/* ---------------- Subscription Plans ---------------- */

const PLANS = [
  { key: "enterprise", rate: 990, blurb: "Unlimited seats guidance, SSO, audit exports, priority support." },
  { key: "business", rate: 499, blurb: "Growing companies: approvals, reports and integrations." },
  { key: "trial", rate: 0, blurb: "14-day evaluation with the full Business feature set." },
];

export function SubscriptionPlansPage() {
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof platformApi.subscriptions>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSubs(await platformApi.subscriptions());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const countOf = (plan: string) => subs?.byPlan.find((p) => p.plan === plan)?.count ?? 0;

  return (
    <section className="page">
      <PageHead title="Subscription Plans" subtitle="Plan catalog and adoption across the platform." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!subs && !error ? <LoadingBlock rows={4} /> : null}
      {subs ? (
        <div className="sa-plan-grid">
          {PLANS.map((p) => (
            <section className="card ldr-section sa-plan" key={p.key}>
              <PlanBadge plan={p.key} />
              <div className="sa-plan-rate">{p.rate ? `$${p.rate}` : "Free"}<span className="cell-muted"> / month</span></div>
              <p className="cell-muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>{p.blurb}</p>
              <div className="sa-plan-meta">
                <span><strong>{countOf(p.key)}</strong> companies</span>
                <span><strong>{money(countOf(p.key) * p.rate)}</strong> MRR</span>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- Assign Subscription ---------------- */

export function AssignSubscriptionPage() {
  const { push } = useToasts();
  const nav = useNavigate();
  const [companies, setCompanies] = useState<{ items: { id: string; name: string; plan: string; planLabel: string; status: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState("enterprise");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await platformApi.companies({ limit: 100 });
      setCompanies({ items: data.items.map((c) => ({ id: c.id, name: c.name, plan: c.plan, planLabel: c.planLabel, status: c.status })) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    try {
      await platformApi.assignPlan(companyId, plan);
      push("Subscription assigned", "success");
      nav("/sa/subscriptions");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <PageHead title="Assign Subscription" subtitle="Move a company onto a plan — the change is logged to the audit trail." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!companies && !error ? <LoadingBlock rows={3} /> : null}
      {companies ? (
        <SectionCard title="Assign a plan">
          <form onSubmit={submit} className="form-stack" style={{ maxWidth: 460 }}>
            <div className="field">
              <label htmlFor="as-company">Company *</label>
              <Select ariaLabel="Company" value={companyId} onChange={setCompanyId} size="md" options={[{ value: "", label: "Select a company…" }, ...companies.items.map((c) => ({ value: c.id, label: `${c.name} (${c.planLabel})` }))]} />
            </div>
            <div className="field">
              <label htmlFor="as-plan">Plan *</label>
              <Select ariaLabel="Plan" value={plan} onChange={setPlan} size="md" options={[{ value: "trial", label: "Trial" }, { value: "business", label: "Business — $499/mo" }, { value: "enterprise", label: "Enterprise — $990/mo" }]} />
            </div>
            <div className="modal-foot" style={{ justifyContent: "flex-start" }}>
              <Button variant="primary" size="md" type="submit" disabled={busy || !companyId}>{busy ? "Assigning…" : "Assign plan"}</Button>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </section>
  );
}

/* ---------------- Billing & Payments ---------------- */

export function BillingPaymentsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.invoices>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.invoices());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead
        title="Billing & Payments"
        subtitle="Invoices, collections and outstanding balances across tenants."
        actions={
          <Button variant="white" size="sm" disabled={!data?.items.length} onClick={() => data && exportCsv("billing", data.items)}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Export
          </Button>
        }
      />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!data && !error ? <LoadingBlock rows={5} /> : null}
      {data ? (
        <>
          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Pkpi icon={CreditCard} label="Collected" value={money(data.summary.collected)} note={`${data.summary.paid} invoices paid`} />
            <Pkpi icon={FileText} label="Outstanding" value={money(data.summary.outstanding)} note={`${data.summary.open} invoices open/overdue`} />
            <Pkpi icon={FileText} label="Invoices" value={String(data.summary.invoices)} note="all time" />
          </div>
          <SectionCard title="All invoices" action={<span className="ldr-count">{data.items.length} rows</span>}>
            <InvoiceTable items={data.items} />
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}

function exportCsv(name: string, items: PlatformInvoice[]) {
  const cols = ["Invoice", "Company", "Plan", "Amount", "Status", "Issued", "Due", "Paid", "Method"];
  const rows = items.map((i) => [i.number, i.company, i.planLabel, i.amountLabel, i.status, i.issued, i.due, i.paid, i.method]);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [cols, ...rows].map((r) => r.map((c) => esc(String(c ?? ""))).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InvoiceTable({ items }: { items: PlatformInvoice[] }) {
  if (!items.length) return <EmptyState icon={FileText} title="No invoices" body="Invoices will appear here once billing events are recorded." />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Company</th>
            <th>Plan</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Issued</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td><strong className="cell-strong">{i.number}</strong></td>
              <td>{i.company}</td>
              <td><PlanBadge plan={i.plan} /></td>
              <td>{i.amountLabel}</td>
              <td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
              <td><span className="cell-muted">{i.issued}</span></td>
              <td><span className="cell-muted">{i.due}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Invoice Detail ---------------- */

export function InvoiceDetailPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.latestInvoice>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.latestInvoice());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead
        title="Invoice Detail"
        subtitle="Review a company invoice and payment history."
        actions={
          <Button variant="white" size="sm" disabled={!data} onClick={() => data && window.print()}>
            <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> Print
          </Button>
        }
      />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!data && !error ? <LoadingBlock rows={4} /> : null}
      {data ? (
        <div className="home-grid">
          <div className="home-col">
            <SectionCard title={`Invoice ${data.invoice.number}`}>
              <dl className="sa-detail-list">
                <div><dt>Company</dt><dd>{data.invoice.company}</dd></div>
                <div><dt>Plan</dt><dd><PlanBadge plan={data.invoice.plan} /></dd></div>
                <div><dt>Amount</dt><dd><strong>{data.invoice.amountLabel}</strong></dd></div>
                <div><dt>Status</dt><dd><Badge tone={statusTone(data.invoice.status)}>{data.invoice.status}</Badge></dd></div>
                <div><dt>Issued</dt><dd>{data.invoice.issued}</dd></div>
                <div><dt>Due</dt><dd>{data.invoice.due}</dd></div>
                <div><dt>Payment</dt><dd>{data.invoice.method || "—"} {data.invoice.paid ? `· paid ${data.invoice.paid}` : ""}</dd></div>
              </dl>
            </SectionCard>
          </div>
          <div className="home-col home-col--side">
            <SectionCard title="Payment history" action={<Link className="home-link" to="/sa/billing">All invoices</Link>}>
              {data.history.length === 0 ? (
                <EmptyState icon={FileText} title="No history" body="No prior invoices for this company." />
              ) : (
                <ul className="home-dept-list">
                  {data.history.map((h) => (
                    <li key={h.id}>
                      <span>{h.number} · {h.amountLabel}</span>
                      <Badge tone={statusTone(h.status)}>{h.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- Subscription Lifecycle ---------------- */

export function SubscriptionLifecyclePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.lifecycle>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.lifecycle());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead title="Subscription Lifecycle" subtitle="Renewals, trials, suspensions and plan-change events across tenants." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!data && !error ? <LoadingBlock rows={5} /> : null}
      {data ? (
        <>
          <div className="ldr-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {data.stages.map((s) => (
              <Pkpi key={s.key} icon={FileText} label={s.label} value={String(s.count)} note="companies" />
            ))}
          </div>
          <SectionCard title="Companies by renewal" action={<span className="ldr-count">{data.companies.length} companies</span>}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Seats</th>
                    <th>MRR</th>
                    <th>Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((c) => (
                    <tr key={c.id}>
                      <td><strong className="cell-strong">{c.name}</strong></td>
                      <td><PlanBadge plan={c.plan} /></td>
                      <td><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                      <td><span className="cell-muted">{c.seatsUsed}/{c.seats}</span></td>
                      <td>{money(c.mrr)}</td>
                      <td><span className="cell-muted">{c.renewal}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard title="Lifecycle events">
            <ul className="home-dept-list">
              {data.events.map((e) => (
                <li key={e.id}>
                  <span><strong>{e.action}</strong> — {e.targetName || e.detail}</span>
                  <span className="cell-muted">{e.createdLabel}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}

/* ---------------- Usage & Limits ---------------- */

export function UsageLimitsPage() {
  const [items, setItems] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await platformApi.usage()).items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead title="Usage & Limits" subtitle="Seat utilization per tenant — spot companies approaching their limits." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!items && !error ? <LoadingBlock rows={5} /> : null}
      {items ? (
        <SectionCard title="Seat usage" action={<span className="ldr-count">{items.length} companies</span>}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Plan</th>
                  <th>Seats</th>
                  <th style={{ minWidth: 160 }}>Utilization</th>
                  <th>MRR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td><strong className="cell-strong">{u.name}</strong></td>
                    <td><PlanBadge plan={u.plan} /></td>
                    <td><span className="cell-muted">{u.seatsUsed}/{u.seats}</span></td>
                    <td>
                      <span className="sa-meter" aria-label={`${u.seatsPct}% of seats used`}>
                        <span className={`sa-meter-fill${u.seatsPct >= 90 ? " sa-meter-fill--hot" : u.seatsPct >= 70 ? " sa-meter-fill--warm" : ""}`} style={{ width: `${u.seatsPct}%` }} />
                      </span>
                      <span className="cell-muted" style={{ fontSize: 12, marginLeft: 8 }}>{u.seatsPct}%</span>
                    </td>
                    <td>{money(u.mrr)}</td>
                    <td><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}

/* ---------------- Platform Activity ---------------- */

export function PlatformActivityPage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof platformApi.activity>>["items"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await platformApi.activity(50)).items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page">
      <PageHead title="Platform Activity" subtitle="Administrative changes, billing events and platform alerts." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!items && !error ? <LoadingBlock rows={6} /> : null}
      {items ? (
        <SectionCard title="Recent events" action={<span className="ldr-count">{items.length} events</span>}>
          {items.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No activity yet" body="Administrative changes will appear here." />
          ) : (
            <ul className="home-dept-list">
              {items.map((a) => (
                <li key={a.id}>
                  <span><strong>{a.action}</strong> — {a.targetName || a.detail || a.category}</span>
                  <span className="cell-muted">{a.actor} · {a.createdLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
    </section>
  );
}

/* ---------------- Integrations ---------------- */

export function IntegrationsPage() {
  const { push } = useToasts();
  const [items, setItems] = useState<IntegrationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await platformApi.integrations()).items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: IntegrationRow) => {
    setBusyKey(row.key);
    try {
      await platformApi.patchIntegration(row.key, !row.connected);
      push(`${row.name} ${row.connected ? "disconnected" : "connected"}`, "success");
      void load();
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="page">
      <PageHead title="Integrations" subtitle="Connect the platform to your communication, storage and finance stack." />
      {error ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}
      {!items && !error ? <LoadingBlock rows={4} /> : null}
      {items ? (
        <div className="sa-integration-grid">
          {items.map((row) => (
            <section className="card ldr-section sa-integration" key={row.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong className="cell-strong">{row.name}</strong>
                <Badge tone={row.connected ? "success" : "gray"}>{row.connected ? "Connected" : "Not connected"}</Badge>
              </div>
              <p className="cell-muted" style={{ fontSize: 13, margin: "8px 0 12px" }}>{row.description}</p>
              <Button variant={row.connected ? "white" : "primary"} size="sm" disabled={busyKey === row.key} onClick={() => void toggle(row)}>
                {busyKey === row.key ? "Saving…" : row.connected ? "Disconnect" : "Connect"}
              </Button>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- SA Notifications ---------------- */

export function SaNotificationsPage() {
  const { items } = useMemo(() => ({ items: [] }), []);
  return (
    <section className="page">
      <PageHead title="Notifications" subtitle="Platform alerts addressed to you." />
      <SectionCard title="Inbox">
        <EmptyState icon={ShieldCheck} title="You're all caught up" body="Platform alerts (failed payments, critical tickets, security events) will appear here." />
      </SectionCard>
      <span hidden>{items.length}</span>
    </section>
  );
}
