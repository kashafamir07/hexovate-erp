import mongoose from "mongoose";

const { Schema } = mongoose;

export const REVIEW_STATUSES = ["draft", "in_review", "completed"];

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    period: { type: String, default: "", index: true }, // e.g. "Q3 2026"
    score: { type: Number, min: 0, max: 100, default: 0 },
    rating: { type: String, default: "" }, // e.g. "Exceeds expectations"
    goals: [{ type: String }],
    feedback: { type: String, default: "" },
    status: { type: String, enum: REVIEW_STATUSES, default: "in_review" },
    reviewDate: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, period: 1 });

export const PerformanceReview = mongoose.model("PerformanceReview", reviewSchema);
