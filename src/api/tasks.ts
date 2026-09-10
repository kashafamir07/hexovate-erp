import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { TaskRow } from "../data/tasks";

interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface TaskDetail extends TaskRow {
  description: string;
  labels: string[];
  createdAt: string;
}

export type TaskStatusApi = "todo" | "in_progress" | "review" | "completed";

export const tasksApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet<Paged<TaskRow>>(`/tasks${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiGet<{ task: TaskDetail }>(`/tasks/${id}`).then((d) => d.task),
  create: (payload: { title: string; description?: string; project?: string; assignedTo?: string; priority?: string; dueDate?: string | null; labels?: string[]; status?: string }) =>
    apiPost<{ task: TaskRow }>("/tasks", payload).then((d) => d.task),
  update: (id: string, patch: Record<string, unknown>) => apiPatch<{ task: TaskRow }>(`/tasks/${id}`, patch).then((d) => d.task),
  setStatus: (id: string, status: string) => apiPatch<{ task: TaskRow }>(`/tasks/${id}/status`, { status }).then((d) => d.task),
  complete: (id: string, done: boolean) => apiPatch<{ task: TaskRow }>(`/tasks/${id}/complete`, { done }).then((d) => d.task),
  remove: (id: string) => apiDelete<null>(`/tasks/${id}`),
};
