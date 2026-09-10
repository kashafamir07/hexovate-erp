import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Printer, Search, Upload, Download } from "lucide-react";
import { hrApi, type PortalDocsData, type ReportData } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { PageHead, SectionCard } from "../widgets";
import { useAuth, useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { downloadCsv, isoOffset, printTable } from "../util";

const UPLOADABLE = ["hr", "admin", "company_admin", "super_admin"];

const HR_REPORTS = [
  { value: "headcount", label: "Headcount" },
  { value: "leave", label: "Leave" },
  { value: "attendance", label: "Attendance" },
  { value: "recruitment", label: "Recruitment" },
  { value: "payroll", label: "Payroll" },
];

/** Figma "HR Portal / Documents" — coverage per category, recent filings, and Upload Document. */
export function PortalDocumentsPage() {
  const { user } = useAuth();
  const { push } = useToasts();
  const [data, setData] = useState<PortalDocsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ employeeId: "", title: "", fileName: "", category: "contract" });

  const canUpload = UPLOADABLE.includes(user?.role || "");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await hrApi.portalDocuments());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // employee picker for the upload form (org-wide roles can pick anyone)
  useEffect(() => {
    if (!canUpload) return;
    void hrApi
      .people({ limit: "200" })
      .then((d) => setEmployees(d.items.map((p) => ({ id: p.id, name: `${p.name}${p.jobTitle ? ` — ${p.jobTitle}` : ""}` }))))
      .catch(() => setEmployees([]));
  }, [canUpload]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.title.trim()) return;
    setBusy(true);
    try {
      await hrApi.uploadPersonDocument(form.employeeId, {
        title: form.title.trim(),
        fileName: form.fileName.trim(),
        category: form.category,
      });
      push("Document filed", "success");
      setUploading(false);
      setForm({ employeeId: "", title: "", fileName: "", category: "contract" });
      void load();
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <LoadingBlock rows={5} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <section className="page">
      <PageHead
        title="Documents"
        subtitle={`${data.summary.filed} documents on file across ${data.summary.employees} employees`}
        actions={
          canUpload ? (
            <Button variant="primary" size="sm" onClick={() => setUploading(true)}>
              <Upload aria-hidden="true" style={{ width: 14, height: 14 }} /> Upload Document
            </Button>
          ) : null
        }
      />

      <SectionCard title="Document categories">
        {data.categories.length > 0 ? (
          <ul className="portal-docs">
            {data.categories.map((c) => (
              <li key={c.id} className="portal-doc-row">
                <span className="portal-doc-label">
                  <FileText aria-hidden="true" /> {c.label}
                </span>
                <span className="portal-doc-meta">
                  {c.count} on file · {c.coverage}% coverage
                </span>
                <span className="progress portal-att-bar" role="progressbar" aria-valuenow={c.coverage} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.label} ${c.coverage}%`}>
                  <span style={{ width: `${c.coverage}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="No documents yet" body="Employee documents will appear here once HR files them." />
        )}
      </SectionCard>

      <SectionCard title="Recently filed">
        {data.recent.length > 0 ? (
          <ul className="portal-events">
            {data.recent.map((r) => (
              <li key={r.id} className="portal-event">
                <Avatar initials={r.person.initials} color={r.person.color} title={r.person.name} />
                <span className="portal-event-body">
                  <strong>
                    {r.person.name} — {r.doc}
                  </strong>
                </span>
                <span className="portal-event-when">{r.when}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mgr-empty">Nothing filed yet.</p>
        )}
      </SectionCard>

      <Modal open={uploading} onClose={() => setUploading(false)} title="Upload document">
        <form onSubmit={submit} className="modal-body form-stack">
          <div className="field">
            <label htmlFor="doc-emp">Employee *</label>
            <Select ariaLabel="Employee" value={form.employeeId} onChange={(v) => setForm((f) => ({ ...f, employeeId: v }))} size="md" options={[{ value: "", label: "Select an employee…" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]} />
          </div>
          <div className="field">
            <label htmlFor="doc-title">Document title *</label>
            <input id="doc-title" className="field-input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Employment Contract" />
          </div>
          <div className="field">
            <label htmlFor="doc-file">File name</label>
            <input id="doc-file" className="field-input" value={form.fileName} onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))} placeholder="Employment Contract.pdf" />
          </div>
          <div className="field">
            <label>Category</label>
            <Select ariaLabel="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} size="md" options={[{ value: "contract", label: "Contract" }, { value: "id", label: "ID document" }, { value: "review", label: "Performance review" }, { value: "tax", label: "Tax form" }, { value: "other", label: "Other" }]} />
          </div>
          <div className="modal-foot">
            <Button variant="ghost" size="md" type="button" onClick={() => setUploading(false)}>Cancel</Button>
            <Button variant="primary" size="md" type="submit" disabled={busy || !form.employeeId || !form.title.trim()}>{busy ? "Filing…" : "File document"}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/** HR Portal / Reports — HR-scoped report types with the shared CSV/print tooling. */
export function PortalReportsPage() {
  const [type, setType] = useState(HR_REPORTS[0].value);
  const [from, setFrom] = useState(isoOffset(-90));
  const [to, setTo] = useState(isoOffset(0));
  const [employee, setEmployee] = useState("");
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ReportData["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hrApi.people().then((d) => setPeople(d.items.map((p) => ({ id: p.id, name: p.name })))).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const params: Record<string, string> = { type, from, to };
      if (employee) params.employee = employee;
      setData((await hrApi.reports(params)).report);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [type, from, to, employee]);

  useEffect(() => {
    void load();
  }, [load]);

  const moneyTypes = ["payroll", "headcount", "recruitment"];
  const ignoreDates = moneyTypes.includes(type);

  return (
    <section className="page">
      <PageHead
        title="Reports"
        subtitle="Generate HR reports — export to CSV or print a copy"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="white" size="sm" disabled={!data} onClick={() => data && downloadCsv(`${type}-report`, data.columns, data.rows)}>
              <Download aria-hidden="true" style={{ width: 14, height: 14 }} /> CSV
            </Button>
            <Button variant="white" size="sm" disabled={!data} onClick={() => data && printTable(data.title, data.subtitle, data.columns, data.rows)}>
              <Printer aria-hidden="true" style={{ width: 14, height: 14 }} /> Print
            </Button>
          </div>
        }
      />

      <SectionCard>
        <div className="ldr-toolbar" style={{ marginBottom: 0 }}>
          <span className="search-input" style={{ maxWidth: 230 }}>
            <Search aria-hidden="true" />
            <Select ariaLabel="Report type" value={type} onChange={setType} size="md" options={HR_REPORTS} />
          </span>
          {!ignoreDates ? (
            <>
              <input type="date" className="field-input" aria-label="From date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
              <span className="cell-muted">to</span>
              <input type="date" className="field-input" aria-label="To date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
            </>
          ) : (
            <span className="cell-muted">{type === "payroll" ? "Payroll report uses the current payroll month" : "This report uses the latest full data"}</span>
          )}
          <Select ariaLabel="Employee" value={employee} onChange={setEmployee} options={[{ value: "", label: "All people" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          <span className="ldr-spacer" />
          {data ? <span className="ldr-count">{data.rowCount} rows</span> : null}
        </div>
      </SectionCard>

      {error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : data.rowCount === 0 ? (
        <EmptyState icon={FileText} title="No rows for this report" body="Try widening the date range or removing filters." />
      ) : (
        <SectionCard
          title={
            <>
              {data.title}
              <span className="cell-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                {data.subtitle}
              </span>
            </>
          }
        >
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </section>
  );
}
