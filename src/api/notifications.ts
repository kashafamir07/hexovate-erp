import { apiDelete, apiGet, apiPatch } from "./client";
import type { NotificationItem } from "../data/session";

export const notificationsApi = {
  list: () => apiGet<{ items: NotificationItem[]; unread: number }>("/notifications"),
  markRead: (id: string) => apiPatch<null>(`/notifications/${id}/read`),
  markAllRead: () => apiPatch<null>("/notifications/read-all"),
  remove: (id: string) => apiDelete<null>(`/notifications/${id}`),
};
