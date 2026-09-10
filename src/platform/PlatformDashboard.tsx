import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, CreditCard, Plus, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { platformApi, type PlatformKpi } from "../api/platform";
import { LoadingBlock, ErrorBlock } from "../components/ui/Async";
import { Button } from "../components/ui/Button";
import { BarChart, Donut, PageHead, SectionCard } from "../leader/widgets";
import { Pkpi } from "./ui";

const KPI_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  subscriptions: CreditCard,
  mrr: Wallet,
  incidents: AlertTriangle,
};

export function PlatformDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof platformApi.dashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await platformApi.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platform data");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock rows={6} />;

  return (
    <section className="page">
      <PageHead
        title="Platform Dashboard"
        subtitle="Global platform health, companies, subscriptions, revenue and alerts."
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate("/sa/companies")}>
            <Plus aria-hidden="true" style={{ width: 14, height: 14 }} /> Manage companies
          </Button>
        }
      />

      <div className="ldr-kpis">
        {data.kpis.map((k: PlatformKpi) => (
          <Pkpi key={k.id} icon={KPI_ICON[k.id] || CreditCard} label={k.label} value={k.value} note={k.note} delta={k.delta} />
        ))}
      </div>

      <div className="ldr-cols">
        <div className="ldr-col">
          <SectionCard title="Subscription Mix" action={<span className="ldr-count">{data.totals.companies} companies</span>}>
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 2px" }}>
              <Donut points={data.planMix} label="companies" />
            </div>
          </SectionCard>
          <SectionCard title="New companies — last 8 months" action={<span className="ldr-count">{data.signups.reduce((s, p) => s + p.value, 0)} total</span>}>
            <BarChart points={data.signups} />
          </SectionCard>
        </div>
        <div className="ldr-col">
          <SectionCard title="Recent Platform Activity" action={<span className="ldr-count">{data.activity.length} events</span>}>
            <ul className="ldr-alerts" style={{ gap: 6 }}>
              {data.activity.map((a) => (
                <li key={a.id} className="ldr-alert ldr-alert--info" style={{ padding: "8px 10px" }}>
                  <span className="ldr-alert-icon">
                    <ActivityIcon category={a.category} />
                  </span>
                  <span>
                    <strong>{a.action}</strong>
                    {a.targetName ? ` · ${a.targetName}` : ""}
                    <br />
                    <span className="ldr-alert-body">
                      {a.detail} — {a.createdLabel}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Platform totals" action={<span className="ldr-count">live</span>}>
            <ul className="ldr-alerts" style={{ gap: 6 }}>
              {[
                ["Companies on platform", String(data.totals.companies)],
                ["Active subscriptions", String(data.totals.active)],
                ["Trials", String(data.totals.trials)],
                ["Suspended", String(data.totals.suspended)],
                ["Seats under management", String(data.totals.seats)],
                ["Audit entries", String(data.totals.auditEntries)],
                ["Open tickets", String(data.totals.openTickets)],
              ].map(([k, v]) => (
                <li className="ldr-alert ldr-alert--info" style={{ padding: "7px 10px", justifyContent: "space-between" }} key={k}>
                  <span>{k}</span>
                  <strong className="ldr-num">{v}</strong>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </section>
  );
}

function ActivityIcon({ category }: { category: string }) {
  const tone: Record<string, string> = {
    company: "#1f3c88",
    subscription: "#6d28d9",
    billing: "#16a34a",
    security: "#dc2626",
    support: "#b45309",
    system: "#374151",
  };
  return (
    <span
      style={{ background: tone[category] || "#1f3c88", width: 9, height: 9, borderRadius: "50%", display: "inline-block", flex: "0 0 auto" }}
      aria-hidden="true"
    />
  );
}
