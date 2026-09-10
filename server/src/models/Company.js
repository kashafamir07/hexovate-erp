import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true, default: "" },
    industry: { type: String, trim: true, default: "" },
    plan: { type: String, enum: ["trial", "business", "enterprise"], default: "trial" },
    status: { type: String, enum: ["trial", "active", "suspended"], default: "trial" },
    seats: { type: Number, default: 5, min: 1 },
    seatsUsed: { type: Number, default: 0, min: 0 },
    contactName: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" },
    renewalDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

companySchema.index({ name: 1 }, { unique: true });
companySchema.index({ plan: 1 });
companySchema.index({ status: 1 });

export const Company = mongoose.model("Company", companySchema);
