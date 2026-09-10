import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, noContent, ok } from "../utils/response.js";
import { chatMessage } from "../utils/serialize.js";
import { relTime } from "../utils/ui.js";

const M_POP = [
  { path: "sender", select: "firstName lastName" },
  { path: "recipients", select: "firstName lastName" },
];

const CHANNELS = [
  { name: "design-team", glyph: "#", color: "#1F3C88", members: "8 members" },
  { name: "website-redesign", glyph: "#", color: "#1F3C88", members: "12 members" },
  { name: "announcements", glyph: "#", color: "#1F3C88", members: "Company-wide" },
];

const dmColor = (u) => (u.jobTitle === "Marketing Lead" ? "#2E86AB" : "#1F3C88");

function meName(u) {
  return `${u.firstName} ${u.lastName}`;
}

const convId = (kind, key) => (kind === "channel" ? `ch:${key}` : `dm:${key}`);

/** Resolve a conversation id to a filter for the current user's messages. */
function conversationFilter(actorId, id) {
  if (String(id).startsWith("ch:")) {
    const name = String(id).slice(3);
    return { channelName: name };
  }
  if (String(id).startsWith("dm:")) {
    const other = String(id).slice(3);
    return { channelName: "", recipients: { $all: [actorId, other] } };
  }
  // Bare channel name or user id are also accepted.
  if (CHANNELS.some((c) => c.name === id)) return { channelName: id };
  return { channelName: "", recipients: { $all: [actorId, id] } };
}

/** GET /api/messages — conversations for the current user. */
export const listConversations = asyncHandler(async (req, res) => {
  const actor = req.user;
  const messages = await Message.find({
    $or: [{ channelName: { $ne: "" } }, { recipients: actor._id }, { sender: actor._id }],
  })
    .populate(M_POP)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  // Channels (static list, message previews from the feed).
  const channelState = {};
  const dmMap = new Map(); // partnerId -> messages
  for (const m of messages) {
    if (m.channelName) {
      (channelState[m.channelName] ||= []).push(m);
    } else {
      const partner = (m.recipients || []).find((r) => String(r._id || r) !== String(actor._id));
      const partnerId = partner ? String(partner._id || partner) : null;
      if (partnerId) {
        if (!dmMap.has(partnerId)) dmMap.set(partnerId, []);
        dmMap.get(partnerId).push(m);
      }
    }
  }

  const unreadFor = (list) =>
    list.filter((m) => {
      const sender = m.sender && typeof m.sender === "object" ? m.sender : null;
      if (sender && String(sender._id) === String(actor._id)) return false;
      return !(m.readBy || []).some((r) => String(r._id || r) === String(actor._id));
    }).length;

  const channels = CHANNELS.map((c) => {
    const list = channelState[c.name] || [];
    const last = list[0];
    return {
      id: convId("channel", c.name),
      kind: "channel",
      name: c.name,
      glyph: c.glyph,
      color: c.color,
      preview: last ? `${senderName(last, actor)}: ${last.body}` : "",
      unread: unreadFor(list),
      members: c.members,
    };
  });

  const partners = [];
  const partnerIds = new Set();
  for (const [partnerId, list] of dmMap) {
    const partner = list[0].recipients?.find((r) => String(r._id || r) === partnerId);
    if (!partner) continue;
    partnerIds.add(partnerId);
    partners.push({
      partner,
      last: list[0],
      list,
    });
  }
  partners.sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));

  const dms = partners.map(({ partner, last, list }) => ({
    id: convId("dm", partnerIdOf(partner)),
    kind: "dm",
    name: meName(partner),
    glyph: initials(meName(partner)),
    color: dmColor(partner),
    preview: last ? `${senderName(last, actor) === meName(partner) ? meName(partner) : "You"}: ${last.body}` : "",
    unread: unreadFor(list),
    lastAt: last.createdAt,
    partnerId: partnerIdOf(partner),
  }));

  return ok(res, { conversations: [...channels, ...dms] });
});

function partnerIdOf(p) {
  return String(p._id || p);
}

function senderName(m, actor) {
  if (!m.sender) return "";
  if (typeof m.sender === "object") {
    const name = meName(m.sender);
    return String(m.sender._id) === String(actor._id) ? name : name;
  }
  return "";
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || "")).toUpperCase();
}

/** GET /api/messages/:id — messages inside one conversation. */
export const getConversation = asyncHandler(async (req, res) => {
  const actor = req.user;
  const filter = conversationFilter(String(actor._id), req.params.id);
  const msgs = await Message.find({ ...filter, $or: filter.channelName ? [] : [{ recipients: actor._id }, { sender: actor._id }] })
    .populate(M_POP)
    .sort({ createdAt: 1 })
    .lean();
  const myName = meName(actor);
  return ok(res, {
    conversation: {
      id: req.params.id,
      messages: msgs.map((m) => chatMessage(m, actor._id, myName)),
    },
  });
});

/** POST /api/messages — send to a conversation or to explicit recipients. */
export const sendMessage = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { conversationId, channelName, recipientId, recipientIds, body, subject } = req.body;
  if (!body || !String(body).trim()) throw new ApiError(422, "Message body is required", [{ field: "body", msg: "Message body is required" }]);

  let recipients = [];
  let chName = "";
  if (channelName) {
    chName = channelName;
    const members = await User.find({ status: "active" }).select("_id").lean();
    recipients = members.map((m) => m._id);
  } else if (recipientIds) {
    recipients = recipientIds;
  } else if (recipientId) {
    recipients = [recipientId];
  } else if (conversationId) {
    if (String(conversationId).startsWith("ch:")) {
      chName = String(conversationId).slice(3);
      const members = await User.find({ status: "active" }).select("_id").lean();
      recipients = members.map((m) => m._id);
    } else {
      const partnerId = String(conversationId).startsWith("dm:") ? String(conversationId).slice(3) : String(conversationId);
      const partner = await User.findById(partnerId);
      if (!partner) throw new ApiError(404, "Recipient not found");
      recipients = [partnerId];
    }
  } else {
    throw new ApiError(422, "Specify conversationId, channelName or recipientId", [{ field: "body", msg: "Missing recipient" }]);
  }

  const message = await Message.create({
    sender: actor._id,
    recipients,
    channelName: chName,
    subject: subject || "",
    body: String(body).trim(),
    readBy: [actor._id],
  });
  return created(res, { message: { id: String(message._id), createdAt: message.createdAt } }, "Message sent");
});

/** PATCH /api/messages/:id/read — mark a conversation (or one message) read. */
export const markRead = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { messageId } = req.body;
  if (messageId) {
    const msg = await Message.findOne({ _id: messageId, $or: [{ recipients: actor._id }, { channelName: { $ne: "" } }] });
    if (!msg) throw new ApiError(404, "Message not found");
    if (!(msg.readBy || []).some((r) => String(r) === String(actor._id))) {
      msg.readBy.push(actor._id);
      await msg.save();
    }
    return ok(res, null, "Marked read");
  }
  const filter = conversationFilter(String(actor._id), req.params.id);
  const msgs = await Message.find(filter);
  let changed = 0;
  for (const m of msgs) {
    if (!(m.readBy || []).some((r) => String(r) === String(actor._id))) {
      m.readBy.push(actor._id);
      await m.save();
      changed += 1;
    }
  }
  return ok(res, { marked: changed }, "Conversation marked read");
});

/** DELETE /api/messages/:id — remove one of the user's own messages. */
export const deleteMessage = asyncHandler(async (req, res) => {
  const msg = await Message.findOne({ _id: req.params.id, sender: req.userId });
  if (!msg) throw new ApiError(404, "Message not found");
  await msg.deleteOne();
  return noContent(res);
});
