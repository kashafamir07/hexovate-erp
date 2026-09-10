import mongoose from "mongoose";

const { Schema } = mongoose;

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "on_hold", "completed"], default: "active" },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    budget: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true }
);

projectSchema.index({ name: "text", description: "text" });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });

export const Project = mongoose.model("Project", projectSchema);
