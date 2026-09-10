import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import type { BadgeTone } from "../types";
import { STATUS_COLORS, scoreTone, type ChartPoint, type Delta, type Kpi, type Person } from "../api/hr";

/* ---------------- page scaffolding ---------------- */

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head leader-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="page-subhead">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({ title, action, children, className = "", style }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`card ldr-section ${className}`.trim()} style={style}>
      {title || action ? (
        <header className="ldr-sec-head">
          <h2>{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* ---------------- KPI cards ---------------- */

const KPI_ICONS: Record<string, LucideIcon> = {
  totalEmployees: UsersIcon,
  active: UserCheckIcon,
  newHires: UserPlusIcon,
  onLeave: CalendarOffIcon,
  attendanceRate: CalendarCheckIcon,
  avgPerformance: TargetIcon,
  teamPerformance: TargetIcon,
  payroll: WalletIcon,
  departments: BuildingIcon,
  turnover: TrendingDown,
  openPositions: BriefcaseIcon,
  pendingApprovals: ClipboardIcon,
  pendingApprovals2: ClipboardIcon,
  pendingTasks: CheckSquareIcon,
  teamSize: UsersIcon,
  deptEmployees: UsersIcon,
  present: UserCheckIcon,
  absent: UserXIcon,
  late: ClockIcon,
};

function DeltaChip({ delta }: { delta: Delta | null }) {
  if (!delta || delta.dir === "flat") {
    return delta ? <Minus aria-hidden="true" /> : null;
  }
  const Icon = delta.dir === "up" ? ArrowUpRight : ArrowDownRight;
  const tone = delta.good === null ? "neutral" : delta.good ? "up" : "down";
  return (
    <span className={`ldr-chip ldr-chip--${tone}`} title={delta.note}>
      <Icon aria-hidden="true" />
      {Math.abs(delta.pct)}%
    </span>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="ldr-kpis">
      {kpis.map((k) => {
        const Icon = KPI_ICONS[k.id] || TrendingUp;
        return (
          <section className="card ldr-kpi" key={k.id}>
            <span className="ldr-kpi-icon">
              <Icon aria-hidden="true" />
            </span>
            <div className="ldr-kpi-body">
              <span className="ldr-kpi-label">{k.label}</span>
              <span className="ldr-kpi-value">{k.value}</span>
              <span className="ldr-kpi-note">
                {k.note || k.sub}
                {k.delta ? <DeltaChip delta={k.delta} /> : null}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- charts (pure SVG / CSS, design tokens) ---------------- */

export function LineChart({ points, unit = "", height = 150 }: { points: ChartPoint[]; unit?: string; height?: number }) {
  const values = points.map((p) => p.value).filter((v) => v != null);
  const max = Math.max(1, ...values);
  const n = points.length;
  const W = 100;
  const H = 38;
  const pts = points.map((p, i) => {
    const x = n <= 1 ? 50 : (i / (n - 1)) * W;
    const y = H - ((p.value || 0) / max) * (H - 6) - 2;
    return { x, y, label: p.label, value: p.value };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${H} L${pts[0].x.toFixed(2)},${H} Z`;
  return (
    <div className="ldr-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trend chart (${unit})`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={`g-${String(points.length)}-${unit.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f3c88" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1f3c88" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${String(points.length)}-${unit.replace(/[^a-z0-9]/gi, "")})`} />
        <path d={line} fill="none" stroke="#1f3c88" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) =>
          p.value != null ? <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="#1f3c88" vectorEffect="non-scaling-stroke" /> : null
        )}
      </svg>
      <div className="ldr-axis">
        {points.length <= 8
          ? points.map((p, i) => (
              <span key={i} className="ldr-axis-label" title={`${p.label}: ${p.value}${unit}`}>
                {p.label}
              </span>
            ))
          : [points[0].label, points[Math.floor(points.length / 2)].label, points[points.length - 1].label].map((l, i) => (
              <span key={i} className="ldr-axis-label">
                {l}
              </span>
            ))}
      </div>
    </div>
  );
}

export function BarChart({ points, unit = "", height = 150 }: { points: ChartPoint[]; unit?: string; height?: number }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="ldr-bars" style={{ height: height + 26 }}>
      <div className="ldr-bar-track">
        {points.map((p, i) => (
          <div className="ldr-bar-col" key={i}>
            <div className="ldr-bar" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} title={`${p.label}: ${p.value}${unit}`} />
            <span className="ldr-bar-val">{p.value}</span>
          </div>
        ))}
      </div>
      <div className="ldr-axis">
        {points.map((p, i) => (
          <span className="ldr-axis-label" key={i}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DistBars({ points, colors = ["#f59e0b", "#c7d2fe", "#2e86ab", "#16a34a", "#6d28d9"] }: { points: ChartPoint[]; colors?: string[] }) {
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  const c = colors.length === points.length ? colors : ["#1f3c88", "#2e86ab", "#16a34a", "#b45309", "#6d28d9", "#dc2626"].slice(0, Math.max(1, points.length));
  return (
    <div className="ldr-dist">
      <div className="ldr-dist-bar" role="img" aria-label="Distribution">
        {points.map((p, i) =>
          p.value > 0 ? (
            <span key={i} className="ldr-dist-seg" style={{ width: `${(p.value / total) * 100}%`, background: c[i % c.length] }} title={`${p.label}: ${p.value}`} />
          ) : null
        )}
      </div>
      <ul className="ldr-legend">
        {points.map((p, i) =>
          p.value > 0 ? (
            <li key={i}>
              <span className="ldr-dot" style={{ background: c[i % c.length] }} />
              <span className="ldr-legend-label">{p.label}</span>
              <strong>{p.value}</strong>
            </li>
          ) : null
        )}
      </ul>
    </div>
  );
}

export function Donut({ points, colors, label = "total" }: { points: ChartPoint[]; colors?: string[]; label?: string }) {
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  const c = colors || ["#1f3c88", "#2e86ab", "#16a34a", "#b45309", "#6d28d9", "#dc2626"];
  let acc = 0;
  const stops: string[] = [];
  points.forEach((p, i) => {
    const start = (acc / total) * 360;
    acc += p.value;
    const end = (acc / total) * 360;
    if (p.value > 0) stops.push(`${c[i % c.length]} ${start}deg ${end}deg`);
  });
  return (
    <div className="ldr-donut-wrap">
      <div className="ldr-donut" style={{ background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#f3f4f6" }} role="img" aria-label={label}>
        <div className="ldr-donut-hole">
          <strong>{total}</strong>
          <span>{label}</span>
        </div>
      </div>
      <ul className="ldr-legend">
        {points.map((p, i) =>
          p.value > 0 ? (
            <li key={i}>
              <span className="ldr-dot" style={{ background: c[i % c.length] }} />
              <span className="ldr-legend-label">{p.label}</span>
              <strong>{p.value}</strong>
            </li>
          ) : null
        )}
      </ul>
    </div>
  );
}

/* ---------------- people rows / status ---------------- */

export function StatusBadge({ status }: { status: string }) {
  const tone = (STATUS_COLORS[status] as BadgeTone) || "gray";
  return <Badge tone={tone}>{status}</Badge>;
}

export function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="cell-muted">—</span>;
  const tone = scoreTone(score);
  return <Badge tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"}>{score}</Badge>;
}

export function PersonCell({ person, sub }: { person: Person; sub?: string }) {
  return (
    <span className="person-cell">
      <Avatar initials={person.initials} color={person.color} title={person.name} />
      <span>
        <strong>{person.name}</strong>
        <br />
        <span className="cell-muted">{sub ?? person.jobTitle ?? ""}</span>
      </span>
    </span>
  );
}

export function AlertsList({ alerts, limit = 6 }: { alerts: { id: string; tone: "danger" | "warning" | "info"; title: string; body: string }[]; limit?: number }) {
  const meta = { danger: { icon: AlertTriangle, cls: "danger" }, warning: { icon: Info, cls: "warning" }, info: { icon: Info, cls: "info" } } as const;
  return (
    <ul className="ldr-alerts">
      {alerts.slice(0, limit).map((a) => {
        const m = meta[a.tone] || meta.info;
        const Icon = m.icon;
        return (
          <li key={a.id} className={`ldr-alert ldr-alert--${m.cls}`}>
            <span className="ldr-alert-icon">
              <Icon aria-hidden="true" />
            </span>
            <span>
              <strong>{a.title}</strong>
              <br />
              <span className="ldr-alert-body">{a.body}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function FmtMoney(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/* icon re-exports used above */
import { Users as UsersIcon, UserCheck as UserCheckIcon, UserPlus as UserPlusIcon, CalendarOff as CalendarOffIcon, CalendarCheck as CalendarCheckIcon, Target as TargetIcon, Wallet as WalletIcon, Building as BuildingIcon, Briefcase as BriefcaseIcon, ClipboardList as ClipboardIcon, CheckSquare as CheckSquareIcon, UserX as UserXIcon, Clock as ClockIcon } from "lucide-react";
