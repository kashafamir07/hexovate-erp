/** Formatting helpers producing the same date/time strings the UI renders. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n) => String(n).padStart(2, "0");

/** 'Oct 15' */
export function monthDay(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** 'Oct 1 – Oct 24' */
export function monthDayRange(start, end) {
  if (!start && !end) return "—";
  if (!end) return monthDay(start);
  if (!start) return monthDay(end);
  return `${monthDay(start)} – ${monthDay(end)}`;
}

/** '9:40 AM' */
export function uiTime(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const h24 = date.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(date.getMinutes())} ${h24 < 12 ? "AM" : "PM"}`;
}

/** '2h 15m' */
export function durLabel(minutes) {
  if (!minutes || minutes <= 0) return "0h 00m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 60) return `${h + 1}h 00m`;
  return `${h}h ${pad(m)}m`;
}

/** '10 min ago' / '1 hour ago' / '2 days ago' */
export function relTime(d, now = new Date()) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return monthDay(date);
}

/** 'JC' */
export function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar color from the Hexovate palette. */
const PALETTE = ["#1F3C88", "#2E86AB", "#16A34A", "#6D28D9", "#B45309", "#DC2626", "#0E7490"];
export function avatarColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d) {
  const x = d instanceof Date ? new Date(d) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Monday of the week containing d */
export function weekStart(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 sun .. 6 sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

/** '0.0' style decimal hours, e.g. 2.25 => '2.25' trimmed to 1-2 decimals */
export function hoursLabel(minutes) {
  const h = minutes / 60;
  return String(Math.round(h * 100) / 100);
}

/** '$1,240' */
export function money(n) {
  if (n == null) return "";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
