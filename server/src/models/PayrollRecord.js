import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    base: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "processing", "paid"], default: "paid" },
  },
  { timestamps: true }
);

payrollSchema.index({ month: 1, user: 1 }, { unique: true });

export const PayrollRecord = mongoose.model("PayrollRecord", payrollSchema);
