import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { Project, ProjectStats } from "../data/projects";

interface Paged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ProjectDetail extends Project {
  startDate: string | null;
  dueDate: string | null;
  budget: { spent: number; total: number; pct: number };
}

export interface ProjectBoard {
  project: { id: string; name: string };
  columns: { status: string; tasks: { id: string; title: string; tag: string; due: string; initials: string; color: string; accent: string; status: string }[] }[];
  columnCount: Record<string, number>;
}

export interface ProjectActivity {
  text: string;
  time?: string;
}

export const projectsApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet<Paged<Project>>(`/projects${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) =>
    apiGet<{ project: ProjectDetail; stats: ProjectStats; activity: ProjectActivity[] }>(`/projects/${id}`).then((d) => d),
  board: (id: string) => apiGet<ProjectBoard>(`/projects/${id}/board`),
  create: (payload: Record<string, unknown>) => apiPost<{ project: Project }>("/projects", payload),
  update: (id: string, patch: Record<string, unknown>) => apiPatch<{ project: ProjectDetail }>(`/projects/${id}`, patch),
  remove: (id: string) => apiDelete<null>(`/projects/${id}`),
};
