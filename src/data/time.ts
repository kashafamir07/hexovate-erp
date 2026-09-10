export type BillableKind = "Billable" | "Non-billable";

export interface TimeEntry {
  id: string;
  date: string;
  task: string;
  project: string;
  duration: string;
  minutes: number;
  billable: BillableKind;
  manual?: boolean;
}

/** Time Tracker entries (Employee board 27). */
export const timeEntries: TimeEntry[] = [
  { id: "e1", date: "Oct 12", task: "Design pricing page", project: "Website Redesign", duration: "2h 15m", minutes: 135, billable: "Billable" },
  { id: "e2", date: "Oct 12", task: "Standup + planning", project: "ERP Implementation", duration: "0h 30m", minutes: 30, billable: "Non-billable" },
  { id: "e3", date: "Oct 12", task: "Homepage QA pass", project: "Website Redesign", duration: "1h 40m", minutes: 100, billable: "Billable", manual: true },
  { id: "e4", date: "Oct 11", task: "Wireframe review", project: "Website Redesign", duration: "1h 20m", minutes: 80, billable: "Billable" },
  { id: "e5", date: "Oct 11", task: "1:1 with Alex", project: "Internal", duration: "0h 45m", minutes: 45, billable: "Non-billable" },
  { id: "e6", date: "Oct 10", task: "Brand token audit", project: "Design System 2.0", duration: "2h 0m", minutes: 120, billable: "Billable" },
];

/** Currently tracked timer (Employee board 27 hero). */
export const currentTracking = {
  task: "Design pricing page",
  project: "Website Redesign",
  /** elapsed seconds of the running timer (mock state) */
  startElapsed: 2 * 3600 + 15 * 60 + 41,
};

/* ---------- Weekly timesheet (board 29) ---------- */
export const timesheetWeek = "Oct 9 – Oct 15, 2026";
export const timesheetDays = ["Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14", "Sun 15"];

export interface TimesheetRow {
  project: string;
  days: (string | null)[];
  total: string;
}

export const timesheetRows: TimesheetRow[] = [
  { project: "Website Redesign", days: ["4.5", "3.0", "5.0", "2.2", "4.0", null, null], total: "18.7" },
  { project: "ERP Implementation", days: ["1.0", "2.0", null, "3.5", "1.0", null, null], total: "7.5" },
  { project: "Internal / Admin", days: ["0.5", null, "1.0", null, "0.8", null, null], total: "2.3" },
];

export const timesheetTotals = ["6.0", "5.0", "6.0", "5.7", "5.8", "0.0", "0.0"];
export const timesheetGrandTotal = "28.5";
