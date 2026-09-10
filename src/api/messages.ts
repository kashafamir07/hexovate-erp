import { apiGet, apiPatch, apiPost } from "./client";
import type { ChatMessage, Conversation } from "../data/messages";

export const messagesApi = {
  conversations: () => apiGet<{ conversations: Conversation[] }>("/messages").then((d) => d.conversations),
  open: (id: string) => apiGet<{ conversation: { id: string; messages: ChatMessage[] } }>(`/messages/${encodeURIComponent(id)}`).then((d) => d.conversation),
  send: (payload: { conversationId?: string; channelName?: string; recipientId?: string; body: string }) =>
    apiPost<{ message: { id: string } }>("/messages", payload),
  markRead: (conversationId: string) => apiPatch<null>(`/messages/${encodeURIComponent(conversationId)}/read`),
};
