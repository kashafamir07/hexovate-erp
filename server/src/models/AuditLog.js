import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, trim: true, default: "system" },
    category: { type: String, enum: ["company", "subscription", "billing", "security", "support", "system"], default: "company" },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, trim: true, default: "" },
    targetName: { type: String, trim: true, default: "" },
    detail: { type: String, trim: true, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
