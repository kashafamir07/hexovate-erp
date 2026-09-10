import { apiGet, apiPost } from "./client";
import type { TimesheetRow } from "../data/time";

export interface TimesheetView {
  id: string | null;
  weekStart: string;
  weekLabel: string;
  days: string[];
  rows: TimesheetRow[];
  totals: string[];
  grandTotal: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  entryCount: number;
}

export const timesheetsApi = {
  currentWeek: (offset = 0) => apiGet<{ timesheet: TimesheetView }>(`/timesheets/mine/current?offset=${offset}`).then((d) => d.timesheet),
  create: (week?: string) => apiPost<{ timesheet: { id: string; weekStart: string; status: string } }>("/timesheets", { week }),
  submit: (id: string) => apiPost<{ timesheet: { id: string; status: string; totalHours: number } }>(`/timesheets/${id}/submit`).then((d) => d.timesheet),
  approve: (id: string, note?: string) => apiPost<{ timesheet: { id: string; status: string } }>(`/timesheets/${id}/approve`, { note }),
  reject: (id: string, note?: string) => apiPost<{ timesheet: { id: string; status: string } }>(`/timesheets/${id}/reject`, { note }),
};
