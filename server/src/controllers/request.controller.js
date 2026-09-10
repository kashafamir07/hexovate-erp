import { Request } from "../models/Request.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { created, ok } from "../utils/response.js";
import { notifyRequestDecision } from "../services/notification.service.js";
import { requestKindLabel, requestStatusLabel, requestToRow } from "../utils/serialize.js";

const REQ_POP = [
  { path: "requester", select: "firstName lastName" },
  { path: "reviewer", select: "firstName lastName" },
];

const typeFromKind = (kind) => {
  const map = { Leave: "leave", Expense: "expense", "Purchase Order": "equipment", Permission: "permission", Equipment: "equipment" };
  return map[kind] || "other";
};

const ORG_REVIEWERS = ["admin", "hr", "company_admin", "super_admin"];

export async function canReviewRequest(actor, request, requester) {
  if (ORG_REVIEWERS.includes(actor.role)) return true;
  if (request.reviewer && String(request.reviewer) === String(actor._id)) return true;
  if (actor.role === "manager") {
    // populated requester docs may lack department/manager, so always fetch fresh
    const rec = await User.findById(request.requester).select("department manager").lean();
    if (!rec) return false;
    return String(rec.manager || "") === String(actor._id);
  }
  return false;
}

async function loadRequest(id) {
  const request = await Request.findById(id).populate(REQ_POP).lean();
  if (!request) throw new ApiError(404, "Request not found");
  return request;
}

/** GET /api/requests — scope=mine (default) | reviewable | all */
export const listRequests = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { scope = "mine", status, type } = req.query;
  const filter = {};
  const privileged = ORG_REVIEWERS.includes(actor.role);

  if (scope === "reviewable" && actor.role === "manager") {
    const reports = await User.find({ manager: actor._id }).select("_id").lean();
    filter.$or = [{ reviewer: actor._id }, { requester: { $in: [actor._id, ...reports.map((r) => r._id)] } }];
  } else if (scope === "reviewable" && !privileged) {
    throw new ApiError(403, "Only managers, HR and admins can review requests");
  } else if (scope === "all" && !privileged) {
    throw new ApiError(403, "Forbidden");
  } else if (scope === "mine") {
    filter.requester = actor._id;
  } else if (privileged) {
    filter.requester = actor._id;
  }

  if (status) filter.status = status;
  if (type) filter.type = typeFromKind(type);

  const docs = await Request.find(filter).populate(REQ_POP).sort({ createdAt: -1 }).limit(200).lean();
  return ok(res, { items: docs.map(requestToRow), scope });
});

export const getRequest = asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id);
  const actor = req.user;
  const requester = request.requester && typeof request.requester === "object" ? request.requester : null;
  const isOwner = String(request.requester) === String(actor._id);
  if (!isOwner && !(await canReviewRequest(actor, request, requester))) {
    throw new ApiError(403, "You cannot view this request");
  }
  return ok(res, { request: requestToRow(request) });
});

/** POST /api/requests */
export const createRequest = asyncHandler(async (req, res) => {
  const actor = req.user;
  const { type, title, description, startDate, endDate, amount } = req.body;
  let reviewer = null;
  const myRecord = await User.findById(actor._id).select("manager").lean();
  if (myRecord?.manager) reviewer = myRecord.manager;

  const request = await Request.create({
    requester: actor._id,
    type,
    title: title || "New request",
    description: description || "",
    status: "pending",
    reviewer,
    startDate: startDate || null,
    endDate: endDate || null,
    amount: amount ?? null,
  });
  return created(res, { request: requestToRow(await loadRequest(request._id)) }, "Request submitted");
});

/** PATCH /api/requests/:id — owner edits pending; privileged updates response. */
export const updateRequest = asyncHandler(async (req, res) => {
  const actor = req.user;
  const request = await Request.findById(req.params.id);
  if (!request) throw new ApiError(404, "Request not found");
  const isOwner = String(request.requester) === String(actor._id);
  if (isOwner) {
    if (request.status !== "pending") throw new ApiError(409, "Only pending requests can be edited");
    const allowed = ["title", "description", "startDate", "endDate", "amount"];
    for (const key of allowed) if (req.body[key] !== undefined) request[key] = req.body[key];
    await request.save();
    return ok(res, { request: requestToRow(await loadRequest(request._id)) }, "Request updated");
  }
  if (!(await canReviewRequest(actor, request))) throw new ApiError(403, "You cannot edit this request");
  if (req.body.response !== undefined) request.response = req.body.response;
  await request.save();
  return ok(res, { request: requestToRow(await loadRequest(request._id)) }, "Request updated");
});

/** DELETE /api/requests/:id — own pending request (withdraw). */
export const withdrawRequest = asyncHandler(async (req, res) => {
  const actor = req.user;
  const request = await Request.findById(req.params.id);
  if (!request) throw new ApiError(404, "Request not found");
  if (String(request.requester) !== String(actor._id)) throw new ApiError(403, "Only the requester can withdraw");
  if (request.status !== "pending") throw new ApiError(409, "Only pending requests can be withdrawn");
  request.status = "withdrawn";
  await request.save();
  return ok(res, { request: requestToRow(await loadRequest(request._id)) }, "Request withdrawn");
});

async function decide(req, res, decision) {
  const actor = req.user;
  const request = await Request.findById(req.params.id).populate("requester", "firstName lastName");
  if (!request) throw new ApiError(404, "Request not found");
  if (request.status !== "pending") throw new ApiError(409, "Request has already been decided");
  if (!(await canReviewRequest(actor, request, request.requester))) {
    throw new ApiError(403, "You are not the reviewer of this request");
  }
  request.status = decision;
  request.response = req.body?.note || "";
  await request.save();
  await notifyRequestDecision(request.requester._id, request.title, decision);
  return ok(res, { request: requestToRow(await loadRequest(request._id)) }, `Request ${decision}`);
}

export const approveRequest = asyncHandler(async (req, res) => decide(req, res, "approved"));
export const rejectRequest = asyncHandler(async (req, res) => decide(req, res, "rejected"));
