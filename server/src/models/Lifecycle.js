import mongoose from "mongoose";

const { Schema } = mongoose;

/** One checklist step on an onboarding/offboarding record. */
const stepSchema = new Schema(
  {
    label: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

/** HR-owned checklist tracking a new hire's first days. */
const onboardingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    jobTitle: { type: String, default: "" },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    startDate: { type: Date, required: true },
    steps: { type: [stepSchema], default: [] },
    status: { type: String, enum: ["not_started", "in_progress", "complete"], default: "in_progress", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

/** HR-owned checklist tracking a leaver's exit. */
const offboardingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    jobTitle: { type: String, default: "" },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    lastWorkingDay: { type: Date, required: true },
    reason: { type: String, enum: ["Resignation", "Contract End", "Termination", "Retirement", "Other"], default: "Resignation" },
    steps: { type: [stepSchema], default: [] },
    status: { type: String, enum: ["not_started", "in_progress", "complete"], default: "in_progress", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const ONBOARDING_STEPS = [
  "Offer letter signed",
  "Employment contract issued",
  "CNIC & documents collected",
  "IT account & email created",
  "Laptop & equipment assigned",
  "Workstation & access badge ready",
  "Orientation session scheduled",
  "Buddy / mentor assigned",
  "Probation review date set (Day 90)",
];

export const OFFBOARDING_STEPS = [
  "Resignation letter received & filed",
  "Manager handover plan confirmed",
  "Exit interview scheduled",
  "Final leave balance calculated",
  "Company asset return (laptop, badge)",
  "IT access revocation requested",
  "Full & final settlement initiated",
  "Experience letter drafted",
];

export const OnboardingRecord = mongoose.model("OnboardingRecord", onboardingSchema);
export const OffboardingRecord = mongoose.model("OffboardingRecord", offboardingSchema);
