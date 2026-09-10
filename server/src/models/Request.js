import mongoose from "mongoose";

const { Schema } = mongoose;

export const REQUEST_TYPES = ["leave", "permission", "equipment", "expense", "other"];
export const REQUEST_STATUSES = ["pending", "approved", "rejected", "withdrawn"];

const requestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: REQUEST_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: REQUEST_STATUSES, default: "pending", index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    response: { type: String, default: "" },
    // Leave specifics
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    amount: { type: Number, default: null }, // expense amount
  },
  { timestamps: true }
);

requestSchema.index({ requester: 1, createdAt: -1 });
requestSchema.index({ reviewer: 1, status: 1 });

export const Request = mongoose.model("Request", requestSchema);
