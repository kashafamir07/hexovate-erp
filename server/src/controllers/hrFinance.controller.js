import { JobPosting } from "../models/JobPosting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import * as an from "../services/analytics.service.js";

const money = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

/** GET /hr/payroll — monthly cost summary + per-employee records for a month. */
export const hrPayroll = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const months = await an.payrollByMonth(6);
  let active = month ? String(month) : months[months.length - 1]?.key;
  if (!months.some((m) => m.key === active) && months.length) active = months[months.length - 1].key;

  const records = await an.payrollRecords(active);
  const users = await an.orgUsers();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const items = records.map((r) => {
    const userId = r.user && typeof r.user === "object" ? String(r.user._id) : String(r.user || "");
    const u = byId.get(userId);
    const person = u ? an.personRow(u) : an.personRow({ _id: r.user });
    return {
      id: String(r._id),
      ...person,
      base: money(r.base),
      allowances: money(r.allowances),
      deductions: money(r.deductions),
      net: money(r.net),
      status: r.status,
    };
  });
  const current = months.find((m) => m.key === active) || { net: 0, base: 0, allowances: 0, deductions: 0, rows: 0 };
  const prev = months[months.length - 2];
  return ok(res, {
    months: months.map((m) => ({ key: m.key, label: m.label, net: m.net })),
    month: active,
    summary: {
      label: active,
      employees: items.length,
      net: current.net,
      base: current.base,
      allowances: current.allowances,
      deductions: current.deductions,
      vsPrev: prev ? Math.round(((current.net - prev.net) / (prev.net || 1)) * 1000) / 10 : null,
    },
    items,
  });
});

/** GET /hr/recruitment — open positions, funnel + hiring trend. */
export const hrRecruitment = asyncHandler(async (req, res) => {
  const [positions, users] = await Promise.all([
    JobPosting.find({}).populate("department", "name").sort({ postedAt: -1 }).lean(),
    an.orgUsers(),
  ]);
  const items = positions.map((p) => ({
    id: String(p._id),
    title: p.title,
    departmentName: p.department && typeof p.department === "object" ? p.department.name : p.departmentName || "",
    openings: p.openings || 1,
    applicants: p.applicants || 0,
    hired: p.hired || 0,
    status: p.status,
    location: p.location || "",
    postedAt: p.postedAt || null,
    postedLabel: p.postedAt ? new Date(p.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
  }));
  const movement = an.movementByMonth(users, 8);
  return ok(res, {
    summary: {
      open: items.filter((i) => i.status === "open").reduce((s, i) => s + i.openings, 0),
      postings: items.filter((i) => i.status === "open").length,
      applicants: items.reduce((s, i) => s + i.applicants, 0),
      hired: items.reduce((s, i) => s + i.hired, 0),
    },
    trend: movement.map((m) => ({ label: m.label, value: m.hires })),
    items,
  });
});
