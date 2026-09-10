import type { BadgeTone } from "../types";

export type RequestKind = "Leave" | "Expense" | "Purchase Order";
export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Withdrawn";

export interface RequestRow {
  id: string;
  kind: RequestKind;
  description: string;
  dates: string;
  submitted: string;
  approver: string;
  status: RequestStatus;
  notes?: string;
}

export const kindTone: Record<RequestKind, BadgeTone> = {
  Leave: "gray",
  Expense: "gray",
  "Purchase Order": "gray",
};

export const statusTone: Record<RequestStatus, BadgeTone> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  Withdrawn: "gray",
};

export const defaultRequests: RequestRow[] = [
  {
    id: "r1",
    kind: "Leave",
    description: "Vacation — Family trip",
    dates: "Oct 21 – Oct 25",
    submitted: "Oct 5",
    approver: "Alex Rivera",
    status: "Pending",
    notes: "Family trip, reachable by email for urgent items.",
  },
  {
    id: "r2",
    kind: "Expense",
    description: "Client dinner — TechNova",
    dates: "Oct 3",
    submitted: "Oct 4",
    approver: "Alex Rivera",
    status: "Approved",
  },
  {
    id: "r3",
    kind: "Leave",
    description: "Sick day",
    dates: "Sep 28",
    submitted: "Sep 28",
    approver: "Alex Rivera",
    status: "Approved",
  },
  {
    id: "r4",
    kind: "Purchase Order",
    description: "Figma seat renewal",
    dates: "—",
    submitted: "Sep 20",
    approver: "Alex Rivera",
    status: "Rejected",
  },
];

export const requestFilters = [
  { id: "all", label: "All" },
  { id: "Leave", label: "Leave" },
  { id: "Expense", label: "Expenses" },
  { id: "PO", label: "Purchase Orders" },
] as const;
