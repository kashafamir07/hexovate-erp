import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    companyName: { type: String, trim: true, default: "" },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
    reporter: { type: String, trim: true, default: "" },
    assignee: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
