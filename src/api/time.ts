import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { TimeEntry } from "../data/time";

interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface CurrentTimer {
  id: string;
  task: string;
  project: string;
  startElapsed: number;
}

export interface TimeSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  hours: number;
  byProject: { project: string; minutes: number }[];
  byDay: { date: string; minutes: number }[];
}

export const timeApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet<Paged<TimeEntry>>(`/time${qs ? `?${qs}` : ""}`);
  },
  current: () => apiGet<{ current: CurrentTimer | null }>("/time/current").then((d) => d.current),
  start: (payload: { project?: string; task?: string; taskName?: string; description?: string; billable?: boolean }) =>
    apiPost<{ timer: CurrentTimer }>("/time/start", payload).then((d) => d.timer),
  stop: () => apiPost<{ entry: TimeEntry }>("/time/stop").then((d) => d.entry),
  manual: (payload: { project?: string; taskName?: string; description?: string; date?: string; minutes: number; billable?: boolean }) =>
    apiPost<{ entry: TimeEntry }>("/time", payload).then((d) => d.entry),
  summary: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet<{ summary: TimeSummary }>(`/time/summary${qs ? `?${qs}` : ""}`).then((d) => d.summary);
  },
  update: (id: string, patch: Record<string, unknown>) => apiPatch<{ entry: TimeEntry }>(`/time/${id}`, patch).then((d) => d.entry),
  remove: (id: string) => apiDelete<null>(`/time/${id}`),
};
