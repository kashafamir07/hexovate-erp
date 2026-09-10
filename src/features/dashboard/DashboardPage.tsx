import { useOutletContext } from "react-router-dom";
import { useApiData } from "../../lib/useApiData";
import { dashboardApi } from "../../api/dashboard";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";

/**
 * Dashboard page. Loads the /api/dashboard payload (shaped exactly for the
 * existing Figma widgets) and renders the matching desktop/mobile layout.
 */
export function DashboardPage() {
  const { variant } = useOutletContext<{ variant: "desktop" | "mobile" }>();
  const { data, loading, error, reload } = useApiData(() => dashboardApi.get(), []);

  if (loading) {
    return (
      <section className={variant === "desktop" ? "dash-desktop" : "dash-mobile"}>
        <LoadingBlock rows={4} />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="page">
        <ErrorBlock message={error ?? "No dashboard data available yet."} onRetry={() => void reload()} />
      </section>
    );
  }

  return variant === "desktop" ? <DashboardDesktop dash={data} /> : <DashboardMobile dash={data} />;
}
