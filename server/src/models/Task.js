import mongoose from "mongoose";

const { Schema } = mongoose;

export const TASK_STATUSES = ["todo", "in_progress", "review", "completed"];

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium", index: true },
    dueDate: { type: Date, default: null },
    labels: [{ type: String }],
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ title: "text", description: "text" });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1 });

export const Task = mongoose.model("Task", taskSchema);
