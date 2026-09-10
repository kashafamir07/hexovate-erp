import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { Announcement } from "../data/announcements";

export const announcementsApi = {
  list: () => apiGet<{ items: Announcement[] }>("/announcements").then((d) => d.items),
  create: (body: { title: string; content: string; priority?: string }) =>
    apiPost<{ announcement: Announcement }>("/announcements", body).then((d) => d.announcement),
  update: (id: string, body: { title?: string; content?: string; priority?: string }) =>
    apiPatch<{ announcement: Announcement }>(`/announcements/${id}`, body).then((d) => d.announcement),
  remove: (id: string) => apiDelete<null>(`/announcements/${id}`),
};
