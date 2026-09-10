import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { scopeOf } from "../utils/leader.js";
import * as an from "../services/analytics.service.js";

const periodLabel = (p) => {
  const m = { Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4" };
  const [, y, q] = String(p || "").match(/^(\d{4})-(Q[1-4])$/) || [];
  return q ? `${m[q]} ${y}` : p || "—";
};

function reviewRow(r, deptNameById) {
  const u = r.user && typeof r.user === "object" ? r.user : null;
  const person = an.personRow(u || { _id: r.user });
  const reviewer = r.reviewer && typeof r.reviewer === "object" ? r.reviewer : null;
  return {
    id: String(r._id),
    period: r.period || "",
    periodLabel: periodLabel(r.period),
    person: {
      ...person,
      departmentName: u?.department ? deptNameById.get(String(u.department)) || "" : "",
    },
    score: r.score ?? null,
    rating: r.rating || an.ratingOf(r.score),
    status: r.status,
    reviewDate: r.reviewDate || null,
    reviewer: reviewer ? `${reviewer.firstName} ${reviewer.lastName || ""}`.trim() : "",
    goals: r.goals || [],
    feedback: r.feedback || "",
  };
}

/** GET /hr/performance — reviews + distribution + period trend, scoped. */
export const hrPerformanceList = asyncHandler(async (req, res) => {
  const actor = req.user;
  const scope = await scopeOf(actor);
  const { period, status, search } = req.query;
  const [reviews, departments] = await Promise.all([
    an.performanceReviews(scope.userIds, { period, status, search }),
    import("../models/Department.js").then(({ Department }) => Department.find({}).select("name").lean()),
  ]);
  const deptNameById = new Map(departments.map((d) => [String(d._id), d.name]));

  const items = reviews.map((r) => reviewRow(r, deptNameById));
  const snapshot = await an.perfSnapshot(scope.userIds);

  // trend per period (completed averages)
  const completed = reviews.filter((r) => r.status === "completed");
  const periods = [...new Set(completed.map((r) => r.period))].sort();
  const trend = periods.map((p) => {
    const set = completed.filter((r) => r.period === p);
    return { period: periodLabel(p), avg: Math.round((set.reduce((s, r) => s + (r.score || 0), 0) / set.length) * 10) / 10 };
  });

  return ok(res, {
    scope: { type: scope.type, name: scope.name },
    overview: {
      avg: snapshot.avg,
      distribution: Object.entries(snapshot.dist).map(([label, value]) => ({ label, value })),
      trend,
    },
    items,
  });
});

const WRITERS = ["manager", "hr", "admin", "company_admin", "super_admin"];

/** PATCH /hr/performance/:id — leaders submit scores/feedback for reviews in scope. */
export const hrPerformanceUpdate = asyncHandler(async (req, res) => {
  const actor = req.user;
  if (!WRITERS.includes(actor.role)) throw new ApiError(403, "Executives have read-only access to performance reviews");
  const { id } = req.params;
  const { PerformanceReview } = await import("../models/PerformanceReview.js");
  const review = await PerformanceReview.findById(id).populate("user", "department manager");
  if (!review) throw new ApiError(404, "Review not found");

  const scope = await scopeOf(actor);
  const uid = String(review.user?._id || review.user);
  if (!scope.userIds.some((x) => String(x) === uid)) throw new ApiError(403, "This employee is not in your scope");

  const { score, rating, feedback, goals, status } = req.body;
  if (score !== undefined) {
    const n = Number(score);
    if (Number.isNaN(n) || n < 0 || n > 100) throw new ApiError(422, "Score must be between 0 and 100", [{ field: "score", msg: "Score must be between 0 and 100" }]);
    review.score = n;
    review.rating = rating || an.ratingOf(n);
  }
  if (rating !== undefined && typeof rating === "string") review.rating = rating;
  if (feedback !== undefined) review.feedback = String(feedback).slice(0, 4000);
  if (Array.isArray(goals)) review.goals = goals.filter((g) => typeof g === "string").map((g) => g.trim()).slice(0, 12);
  if (status !== undefined) {
    if (!["draft", "in_review", "completed"].includes(status)) throw new ApiError(422, "Unknown review status", [{ field: "status", msg: "Unknown review status" }]);
    review.status = status;
    if (status === "completed" && !review.reviewDate) review.reviewDate = new Date();
  }
  review.reviewer = actor._id;
  await review.save();
  const departments = await import("../models/Department.js").then(({ Department }) => Department.find({}).select("name").lean());
  const deptNameById = new Map(departments.map((d) => [String(d._id), d.name]));
  return ok(res, { review: reviewRow(review.toObject(), deptNameById) }, "Review updated");
});
