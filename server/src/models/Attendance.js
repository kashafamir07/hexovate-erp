import mongoose from "mongoose";

const { Schema } = mongoose;

/** Daily attendance mark for a tracked employee. One doc per user+date. */
const attendanceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "late", "absent", "leave", "half_day"], default: "present" },
    clockIn: { type: Date, default: null },
    clockOut: { type: Date, default: null },
    hours: { type: Number, default: 0 }, // worked hours (decimal)
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
