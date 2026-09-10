import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import type { BadgeTone } from "../types";
import { COMPANY_PLAN_TONE, TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "../api/platform";

/** KPI card with an explicit icon — mirrors .ldr-kpi but accepts any lucide icon. */
export function Pkpi({ icon: Icon, label, value, note, delta }: { icon: LucideIcon; label: string; value: string; note?: string; delta?: { pct: number; dir: "up" | "down"; note: string; good: boolean } | null }) {
  return (
    <section className="card ldr-kpi">
      <span className="ldr-kpi-icon">
        <Icon aria-hidden="true" />
      </span>
      <div className="ldr-kpi-body">
        <span className="ldr-kpi-label">{label}</span>
        <span className="ldr-kpi-value">{value}</span>
        <span className="ldr-kpi-note">
          {note}
          {delta ? <MiniDelta d={delta} /> : null}
        </span>
      </div>
    </section>
  );
}

function MiniDelta({ d }: { d: { pct: number; dir: "up" | "down"; note: string; good: boolean } }) {
  const Icon = d.dir === "up" ? ArrowUpRight : ArrowDownRight;
  const tone = d.good === null ? "neutral" : d.good ? "up" : "down";
  return (
    <span className={`ldr-chip ldr-chip--${tone}`} title={d.note}>
      <Icon aria-hidden="true" />
      {Math.abs(d.pct)}%
    </span>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const tone: BadgeTone = COMPANY_PLAN_TONE[plan] || "gray";
  return <Badge tone={tone}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Badge>;
}

export function CompanyStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === "active" ? "success" : status === "suspended" ? "danger" : "warning";
  return <Badge tone={tone}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export function TicketStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = TICKET_STATUS_TONE[status] || "gray";
  const label = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge tone={tone}>{label}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  const tone: BadgeTone = TICKET_PRIORITY_TONE[priority] || "gray";
  return <Badge tone={tone}>{priority}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  const tone: BadgeTone =
    category === "company"
      ? "primary"
      : category === "subscription"
        ? "violet"
        : category === "billing"
          ? "success"
          : category === "security"
            ? "danger"
            : category === "support"
              ? "warning"
              : "gray";
  return <Badge tone={tone}>{category}</Badge>;
}

/** Money shorthand used by chart axes: 7680 -> "7.7". */
export function toK(n: number): number {
  return Math.round((n / 1000) * 10) / 10;
}
