import { useCallback, useEffect, useState } from "react";
import { Download, FileBarChart, Printer, Search } from "lucide-react";
import { hrApi, type ReportData } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { isOrgKind, type RoleConfig } from "../nav";
import { PageHead, SectionCard } from "../widgets";
import { downloadCsv, isoOffset, printTable } from "../util";

const ORG_REPORTS = [
  { value: "headcount", label: "Headcount" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "performance", label: "Performance" },
  { value: "payroll", label: "Payroll" },
  { value: "recruitment", label: "Recruitment" },
  { value: "dept", label: "Department comparison" },
];

const REPORT_TYPES: Record<string, { label: string; types: { value: string; label: string }[] }> = {
  hr: {
    label: "HR reports",
    types: [
      { value: "headcount", label: "Headcount" },
      { value: "leave", label: "Leave" },
      { value: "attendance", label: "Attendance" },
      { value: "recruitment", label: "Recruitment" },
      { value: "payroll", label: "Payroll" },
    ],
  },
  executive: { label: "Executive reports", types: ORG_REPORTS },
  ceo: { label: "Organization reports", types: ORG_REPORTS },
  company_admin: { label: "Administration reports", types: ORG_REPORTS },
  super_admin: { label: "Organization reports", types: ORG_REPORTS },
  manager: {
    label: "Team reports",
    types: [
      { value: "attendance", label: "Attendance" },
      { value: "leave", label: "Leave" },
      { value: "performance", label: "Performance" },
      { value: "task", label: "Task activity" },
    ],
  },
};

export function LeaderReportsPage({ cfg, initialType }: { cfg: RoleConfig; initialType?: string }) {
  const { push } = useToasts();
  const valid = initialType && REPORT_TYPES[cfg.kind].types.some((t) => t.value === initialType) ? initialType : undefined;
  const [type, setType] = useState(valid ?? REPORT_TYPES[cfg.kind].types[0].value);
  const [from, setFrom] = useState(isoOffset(-90));
  const [to, setTo] = useState(isoOffset(0));
  const [dept, setDept] = useState("");
  const [employee, setEmployee] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ReportData["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hrApi.people().then((d) => {
      setPeople(d.items.map((p) => ({ id: p.id, name: p.name })));
      setDepartments(d.filters.departments);
    }).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const params: Record<string, string> = { type, from, to };
      if (dept) params.department = dept;
      if (employee) params.employee = employee;
      setData((await hrApi.reports(params)).report);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [type, from, to, dept, employee]);

  useEffect(() => {
    void load();
  }, [load]);

  const moneyTypes = ["payroll", "headcount", "recruitment"];
  const ignoreDates = moneyTypes.includes(type);

  return (
    <section className="page">
      <PageHead
        title={isOrgKind(cfg.kind) ? "Reports & Analytics" : "Reports"}
        subtitle="Generate department/team reports — export to CSV or print a copy"
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
            <Select ariaLabel="Report type" value={type} onChange={setType} size="md" options={REPORT_TYPES[cfg.kind].types} />
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
          {isOrgKind(cfg.kind) ? (
            <Select ariaLabel="Department" value={dept} onChange={setDept} options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          ) : null}
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
        <EmptyState icon={FileBarChart} title="No rows for this report" body="Try widening the date range or removing filters." />
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
                {data.rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 1 ? "striped" : ""}>
                    {r.map((cell, j) => (
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
