import mongoose from "mongoose";

const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    goals: [{ type: String }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export const Department = mongoose.model("Department", departmentSchema);
