import mongoose from "mongoose";

/** Third-party integration catalog with connection state. */
const integrationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, enum: ["communication", "storage", "finance", "analytics", "other"], default: "other" },
    connected: { type: Boolean, default: false },
    configuredBy: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PlatformIntegration = mongoose.model("PlatformIntegration", integrationSchema);
