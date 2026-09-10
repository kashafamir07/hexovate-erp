import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },
    location: { type: String, default: "" },
    skills: [{ type: String }],
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    notificationPrefs: {
      taskAssignments: { type: Boolean, default: true },
      approvalUpdates: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    role: {
      type: String,
      enum: ["employee", "manager", "admin", "hr", "executive", "ceo", "company_admin", "super_admin"],
      default: "employee",
      index: true,
    },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    jobTitle: { type: String, default: "" },
    employeeId: { type: String, unique: true, sparse: true },
    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["active", "inactive", "invited"], default: "active" },
    employmentType: { type: String, enum: ["full_time", "part_time", "contract", "intern"], default: "full_time" },
    joinedAt: { type: Date, default: Date.now },
    birthDate: { type: Date, default: null }, // used for birthdays & anniversaries widgets
    leftAt: { type: Date, default: null }, // set when the employee leaves (turnover reporting)
    lastLogin: { type: Date, default: null },
    // Password reset (sha-256 of a random token, single use, 30 min expiry)
    resetTokenHash: { type: String, select: false, default: null },
    resetExpires: { type: Date, select: false, default: null },
    // Org-chart display opt-out (people outside the leadership tree view)
    orgHidden: { type: Boolean, default: false },
    // Annual leave entitlement in days (dashboard stat)
    leaveBalanceDays: { type: Number, default: 14 },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { passwordHash, ...rest } = this.toObject();
  return rest;
};

userSchema.index({ firstName: "text", lastName: "text", email: "text", jobTitle: "text" });

export const User = mongoose.model("User", userSchema);
