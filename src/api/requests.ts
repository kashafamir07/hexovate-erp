import { apiDelete, apiGet, apiPost } from "./client";
import type { RequestRow } from "../data/requests";

export const requestsApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet<{ items: RequestRow[] }>(`/requests${qs ? `?${qs}` : ""}`).then((d) => d.items);
  },
  create: (payload: {
    type: "leave" | "permission" | "equipment" | "expense" | "other";
    title: string;
    description?: string;
    startDate?: string | null;
    endDate?: string | null;
    amount?: number | null;
  }) => apiPost<{ request: RequestRow }>("/requests", payload).then((d) => d.request),
  withdraw: (id: string) => apiDelete<{ request: RequestRow }>(`/requests/${id}`).then((d) => d.request),
};
