import mongoose from "mongoose";

const { Schema } = mongoose;

const jobPostingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    departmentName: { type: String, default: "" },
    openings: { type: Number, default: 1 },
    applicants: { type: Number, default: 0 },
    hired: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "on_hold", "closed"], default: "open", index: true },
    location: { type: String, default: "New York, NY" },
    postedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobPostingSchema.index({ status: 1, postedAt: -1 });

export const JobPosting = mongoose.model("JobPosting", jobPostingSchema);
