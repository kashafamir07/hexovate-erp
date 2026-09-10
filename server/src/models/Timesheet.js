import mongoose from "mongoose";

const { Schema } = mongoose;

export const TIMESHEET_STATUSES = ["draft", "submitted", "approved", "rejected"];

const timesheetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    weekStart: { type: Date, required: true }, // Monday of the week
    entries: [{ type: Schema.Types.ObjectId, ref: "TimeEntry" }],
    totalHours: { type: Number, default: 0 },
    status: { type: String, enum: TIMESHEET_STATUSES, default: "draft", index: true },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    reviewerNote: { type: String, default: "" },
  },
  { timestamps: true }
);

timesheetSchema.index({ user: 1, weekStart: 1 }, { unique: true });

export const Timesheet = mongoose.model("Timesheet", timesheetSchema);
