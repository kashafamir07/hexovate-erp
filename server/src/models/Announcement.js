import mongoose from "mongoose";

const { Schema } = mongoose;

export const ANNOUNCEMENT_AUDIENCES = ["all", "engineering", "marketing", "design", "leadership", "hr"];
export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"];

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: "all", index: true },
    priority: { type: String, enum: ANNOUNCEMENT_PRIORITIES, default: "normal" },
    publishedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ["published", "draft", "archived"], default: "published" },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);
