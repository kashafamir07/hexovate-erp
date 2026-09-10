import mongoose from "mongoose";

/**
 * Platform settings — singleton doc with `key: "platform"`.
 * Backs the Super Admin "Security & Access" page (global toggles).
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "platform", unique: true },
    twoFactorRequired: { type: Boolean, default: false },
    sessionTimeoutMin: { type: Number, default: 60, min: 5, max: 1440 },
    passwordMinLength: { type: Number, default: 8, min: 6, max: 64 },
    allowSignups: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model("PlatformSettings", platformSettingsSchema);
