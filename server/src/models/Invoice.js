import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    plan: { type: String, enum: ["trial", "business", "enterprise"], default: "trial" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["paid", "open", "overdue"], default: "open" },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paymentMethod: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1, issuedAt: -1 });

export const Invoice = mongoose.model("Invoice", invoiceSchema);
