import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Monthly company revenue snapshot (used by the CEO dashboard "Revenue" KPI and
 * revenue trend). One document per calendar month.
 */
const revenueSchema = new Schema(
  {
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    value: { type: Number, required: true, min: 0 }, // gross revenue for the month (USD)
  },
  { timestamps: true }
);

revenueSchema.index({ month: 1 }, { unique: true });

export const RevenueRecord = mongoose.model("RevenueRecord", revenueSchema);
