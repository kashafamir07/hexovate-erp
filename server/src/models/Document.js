import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Employee documents (contracts, IDs, reviews, tax forms…).
 * Files live outside the DB; we store metadata only.
 */
const documentSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    fileName: { type: String, trim: true, default: "" },
    category: { type: String, enum: ["contract", "id", "review", "tax", "other"], default: "other" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

documentSchema.index({ employee: 1, uploadedAt: -1 });

export const DocumentModel = mongoose.model("Document", documentSchema);
