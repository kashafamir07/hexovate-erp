import { User } from "../models/User.js";
import { Department } from "../models/Department.js";

/** Roles that get the leader (HR analytics) experience. */
export const LEADER_ROLES = ["manager", "executive", "hr", "admin", "ceo", "company_admin", "super_admin"];

/** Roles whose dashboards/endpoints are org-wide analytics (no team scoping). */
export const ORG_ROLES = ["executive", "hr", "admin", "ceo", "company_admin", "super_admin"];

/** 'team' (manager: direct reports) | 'org' */
export function scopeType(actor) {
  if (actor.role === "manager") return "team";
  return "org";
}

/**
 * Resolve the people the actor may see/act on.
 * - manager: their direct reports (users whose `manager` field points at them)
 * - executive / hr / admin: the whole active org
 */
export async function scopeOf(actor) {
  const type = scopeType(actor);

  if (type === "team") {
    const reports = await User.find({ manager: actor._id, status: "active" }).select("_id firstName lastName jobTitle department").lean();
    return {
      type,
      userIds: reports.map((r) => r._id),
      deptId: null,
      label: `${reports.length} direct ${reports.length === 1 ? "report" : "reports"}`,
      name: "Your team",
      people: reports,
    };
  }

  const people = await User.find({ status: "active" }).select("_id firstName lastName jobTitle department manager").lean();
  return {
    type,
    userIds: people.map((p) => p._id),
    deptId: null,
    label: "Company",
    name: "Company",
    people,
  };
}

/** Users this actor leads (team) vs the org — used to pick task assignment targets. */
export async function assignableIds(actor) {
  const scope = await scopeOf(actor);
  if (scope.type === "org") {
    // org-scoped leaders can assign to anyone they can see
    const people = await User.find({ status: "active" }).select("_id").lean();
    return people.map((p) => p._id);
  }
  return scope.userIds;
}

/* ---------------- month helpers ---------------- */

export const pad = (n) => String(n).padStart(2, "0");

export function monthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
}

/** Date shifted by `n` months (clamped to end of month). */
export function shiftMonths(d, n) {
  const x = d instanceof Date ? d : new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

/** Inclusive start of month. */
export function startOfMonth(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

export function endOfMonth(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59, 999);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${String(y).slice(2)}`;
}

export function monthShortLabel(key) {
  const [, m] = String(key).split("-").map(Number);
  return MONTHS[(m || 1) - 1];
}

/** Last `n` month keys ending at the month containing `d` (pure arithmetic). */
export function lastMonths(n, d = new Date()) {
  const out = [];
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  for (let k = 0; k < n; k += 1) {
    const idx = m - (n - 1 - k); // month number in a linear timeline (can be <= 0)
    const yy = y + Math.floor((idx - 1) / 12);
    const mm = ((idx - 1) % 12 + 12) % 12 + 1;
    out.push(`${yy}-${pad(mm)}`);
  }
  return out;
}
