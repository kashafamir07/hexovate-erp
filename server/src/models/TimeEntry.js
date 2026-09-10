import mongoose from "mongoose";

const { Schema } = mongoose;

const timeEntrySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    taskName: { type: String, default: "" },
    projectName: { type: String, default: "" },
    date: { type: Date, default: null },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // minutes
    description: { type: String, default: "" },
    billable: { type: Boolean, default: true },
    status: { type: String, enum: ["running", "stopped"], default: "stopped", index: true },
    manual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

timeEntrySchema.index({ user: 1, status: 1 });
timeEntrySchema.index({ user: 1, date: -1 });

export const TimeEntry = mongoose.model("TimeEntry", timeEntrySchema);
