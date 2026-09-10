import mongoose from "mongoose";

/**
 * Role template — a named bundle of capability flags the platform owner
 * can hand to tenant companies (displayed on Role Templates; applied via API).
 */
const roleTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    permissions: [{ type: String, trim: true }],
    system: { type: Boolean, default: false }, // seeded defaults, cannot be deleted
  },
  { timestamps: true }
);

export const RoleTemplate = mongoose.model("RoleTemplate", roleTemplateSchema);
