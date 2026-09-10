import { useCallback, useEffect, useState } from "react";
import { hrApi, type DashboardPayload } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { PageHead, SectionCard } from "../widgets";

const SETTINGS = [
  { id: "profile", label: "Company profile", sub: "Hexovate Inc." },
  { id: "fiscal", label: "Fiscal year", sub: "January–December" },
  { id: "approvals", label: "Approval policies", sub: "Executive approvals" },
  { id: "notifications", label: "Notification policy", sub: "Email + in-app" },
];

/** Figma "MD / Executive — Company Settings": settings rows + Key Metrics / Recent Activity. */
export function ExecCompanySettingsPage() {
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDash(await hrApi.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!dash && !error) return <LoadingBlock rows={5} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!dash) return null;

  const metrics: { value: string; label: string }[] = [
    { value: String(dash.scope?.todayCounts?.total || dash.kpis.find((k) => k.id === "totalEmployees")?.value || "—"), label: "Employees" },
    { value: String(dash.deptPerf?.length || 0), label: "Departments" },
    { value: String(dash.kpis.find((k) => k.id === "pendingApprovals")?.value || dash.kpis.find((k) => k.id === "pendingApprovals2")?.value || "0"), label: "Pending decisions" },
  ];

  return (
    <section className="page">
      <PageHead title="Company Settings" subtitle="Company configuration and executive-visible settings." actions={<Button variant="soft" size="md" onClick={() => window.print()}>Export</Button>} />

      <SectionCard title="Company Settings" action={<Button variant="soft" size="sm">Filter</Button>}>
        <ul className="portal-quick portal-settings">
          {SETTINGS.map((s) => (
            <li key={s.id}>
              <button type="button">
                <span>
                  <strong>{s.label}</strong>
                  <br />
                  <span className="cell-muted">{s.sub}</span>
                </span>
                <span className="portal-settings-right">
                  <span className="cell-muted">Configured</span>
                  <span className="link-btn">View</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="Key Metrics">
            <div className="portal-kpi-strip">
              {metrics.map((m) => (
                <div key={m.label} className="portal-kpi-tile">
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <div className="ldr-col">
          <SectionCard title="Recent Activity">
            {dash.alerts && dash.alerts.length > 0 ? (
              <ul className="portal-activity">
                {dash.alerts.slice(0, 3).map((a) => (
                  <li key={a.id} className="portal-activity-row">
                    <span className="portal-activity-body">
                      <span className="portal-activity-text">{a.title}</span>
                      <br />
                      <span className="portal-activity-time">{a.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mgr-empty">No recent activity.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
