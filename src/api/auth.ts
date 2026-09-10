import { apiGet, apiPatch, apiPost } from "./client";

/** Mirror of the server's public user payload (superset of SessionUser). */
export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  location: string;
  skills: string[];
  emergencyContact?: { name: string; phone: string };
  role: "employee" | "manager" | "admin" | "hr" | "executive" | "ceo" | "company_admin" | "super_admin";
  jobTitle: string;
  employeeId: string;
  departmentId?: string | null;
  departmentName: string;
  managerName?: string | null;
  status: string;
  joinedAt?: string | null;
  notificationPrefs?: { taskAssignments: boolean; approvalUpdates: boolean; weeklyDigest: boolean };
  initials: string;
  color: string;
  /** workspace-style subtitle, e.g. "Product Designer · Design Department" */
  sub?: string;
}

interface AuthData {
  user: ApiUser;
  accessToken: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<AuthData>("/auth/login", { email, password }).then((d) => {
      return d;
    }),
  register: (payload: { firstName: string; lastName: string; email: string; password: string; phone?: string }) =>
    apiPost<AuthData>("/auth/register", payload),
  me: () => apiGet<{ user: ApiUser }>("/auth/me").then((d) => d.user),
  logout: () => apiPost<null>("/auth/logout"),
  forgotPassword: (email: string) => apiPost<{ devToken?: string }>("/auth/forgot-password", { email }),
  resetPassword: (token: string, newPassword: string) => apiPost<null>("/auth/reset-password", { token, newPassword }),
};

export const usersApi = {
  myProfile: () => apiGet<{ user: ApiUser }>("/users/me/profile").then((d) => d.user),
  myProjects: () => apiGet<{ items: import("../data/projects").Project[] }>("/users/me/projects").then((d) => d.items),
  myTasks: () => apiGet<{ items: import("../data/tasks").TaskRow[] }>("/users/me/tasks").then((d) => d.items),
  updateMe: (patch: Partial<ApiUser>) => apiPatch<{ user: ApiUser }>("/users/me", patch).then((d) => d.user),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiPatch<null>("/users/me/password", { currentPassword, newPassword }),
};
