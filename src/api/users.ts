import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { ApiUser } from "./auth";

const qs = (params?: Record<string, string | number | undefined>) => {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export type MgmtUser = ApiUser & {
  managerId?: string | null;
  department: { _id: string; name: string } | null;
};

export const manageUsersApi = {
  list: (params?: Record<string, string | number>) =>
    apiGet<{ items: MgmtUser[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/users${qs(params)}`),
  get: (id: string) => apiGet<{ user: MgmtUser }>(`/users/${id}`).then((d) => d.user),
  create: (body: Record<string, unknown>) => apiPost<{ user: MgmtUser }>("/users", body).then((d) => d.user),
  update: (id: string, body: Record<string, unknown>) => apiPatch<{ user: MgmtUser }>(`/users/${id}`, body).then((d) => d.user),
  remove: (id: string) => apiDelete<null>(`/users/${id}`),
};

export const ROLES = [
  "employee",
  "manager",
  "executive",
  "hr",
  "ceo",
  "company_admin",
  "super_admin",
  "admin",
] as const;

export const ROLE_LABEL: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  executive: "Executive",
  hr: "HR",
  ceo: "CEO",
  company_admin: "Company Admin",
  super_admin: "Super Admin",
  admin: "Admin",
};
