import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Strategic company initiative (CEO/executive priorities board).
 * Statuses mirror the CEO dashboard design: Pending / Review / Healthy / Draft,
 * plus at-risk and completed states used by the full priorities list.
 */
const initiativeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    area: { type: String, default: "" }, // owning area, e.g. Finance / HR / IT / Leadership
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "review", "healthy", "draft", "at_risk", "done"],
      default: "pending",
      index: true,
    },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

initiativeSchema.index({ status: 1, dueDate: 1 });

export const Initiative = mongoose.model("Initiative", initiativeSchema);
