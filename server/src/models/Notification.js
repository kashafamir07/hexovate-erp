import mongoose from "mongoose";

const { Schema } = mongoose;

export const NOTIFICATION_TYPES = ["task", "approval", "mention", "announcement", "timesheet", "system"];

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system", index: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
    relatedEntity: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
