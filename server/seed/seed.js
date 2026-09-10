/**
 * Hexovate ERP — development seed.
 *
 *   npm run seed   (inside server/)
 *
 * Requires a running MongoDB (MONGODB_URI) — when the env var is empty the
 * in-memory MongoDB used by `npm run dev` is NOT shared with this process, so
 * pass MONGODB_URI for a real local instance. Demo credentials are printed at
 * the end (documented in the repository README).
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Announcement } from "../src/models/Announcement.js";
import { Attendance } from "../src/models/Attendance.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Company } from "../src/models/Company.js";
import { Invoice } from "../src/models/Invoice.js";
import { RoleTemplate } from "../src/models/RoleTemplate.js";
import { DocumentModel } from "../src/models/Document.js";
import { SupportTicket } from "../src/models/SupportTicket.js";
import { Department } from "../src/models/Department.js";
import { Initiative } from "../src/models/Initiative.js";
import { JobPosting } from "../src/models/JobPosting.js";
import { Message } from "../src/models/Message.js";
import { RevenueRecord } from "../src/models/RevenueRecord.js";
import { Notification } from "../src/models/Notification.js";
import { OnboardingRecord, OffboardingRecord, ONBOARDING_STEPS, OFFBOARDING_STEPS } from "../src/models/Lifecycle.js";
import { PayrollRecord } from "../src/models/PayrollRecord.js";
import { PerformanceReview } from "../src/models/PerformanceReview.js";
import { Project } from "../src/models/Project.js";
import { Request } from "../src/models/Request.js";
import { Task } from "../src/models/Task.js";
import { TimeEntry } from "../src/models/TimeEntry.js";
import { Timesheet } from "../src/models/Timesheet.js";
import { User } from "../src/models/User.js";
import { weekStart, addDays } from "../src/utils/ui.js";

const PASSWORD = process.env.SEED_PASSWORD || "Password123!";
const DAY = 86400000;
const at = (d, h = 9, m = 0) => {
  const x = new Date(d.getTime());
  x.setHours(h, m, 0, 0);
  return x;
};
const TODAY = new Date();
const monday = weekStart(TODAY);

async function main() {
  const uri = process.env.MONGODB_URI;
  let memory = null;
  if (uri) {
    await mongoose.connect(uri);
  } else {
    memory = await MongoMemoryServer.create();
    await mongoose.connect(memory.getUri());
  }
  // eslint-disable-next-line no-console
  console.log("[seed] connected, dropping existing data…");
  await mongoose.connection.dropDatabase();

  const hash = await bcrypt.hash(PASSWORD, 10);

  const depNames = ["Leadership", "Engineering", "Marketing", "Design", "People Ops", "Finance"];
  const deps = {};
  for (const name of depNames) deps[name] = await Department.create({ name, description: `${name} department`, status: "active" });

  let empCounter = 1001;
  const def = (firstName, lastName, email, role, jobTitle, dept, manager, extra = {}) => {
    empCounter += 1;
    return User.create({
      firstName,
      lastName,
      email,
      passwordHash: hash,
      role,
      jobTitle,
      department: dept,
      manager: manager ? manager._id : null,
      employeeId: `HX-${empCounter}`,
      phone: "+1 (415) 555-0100",
      location: "New York, NY",
      skills: [],
      status: "active",
      joinedAt: addDays(TODAY, -900),
      ...extra,
    });
  };

  const priya = await def("Priya", "Nair", "priya@hexovate.com", "ceo", "Chief Executive Officer", deps.Leadership, null, {
    orgHidden: false,
    leaveBalanceDays: 25,
    skills: ["Strategy", "Operations"],
    location: "New York, NY",
    joinedAt: addDays(TODAY, -1600),
  });
  // Company Administrator — day-to-day org administration (users, departments, approvals)
  const ravi = await def("Ravi", "Mehta", "ravi@hexovate.com", "company_admin", "Company Administrator", deps.Leadership, priya, {
    orgHidden: false,
    leaveBalanceDays: 20,
    location: "New York, NY",
    joinedAt: addDays(TODAY, -540),
  });
  // Super Administrator — platform-level administration
  const nadia = await def("Nadia", "Haddad", "nadia@hexovate.com", "super_admin", "Super Administrator", deps.Leadership, priya, {
    orgHidden: false,
    leaveBalanceDays: 20,
    location: "New York, NY",
    joinedAt: addDays(TODAY, -600),
  });
  const alex = await def("Alex", "Rivera", "alex@hexovate.com", "manager", "Head of Marketing & Sales", deps.Marketing, priya, {
    orgHidden: false,
    leaveBalanceDays: 22,
    location: "Austin, TX",
    skills: ["Marketing", "Sales", "Strategy"],
  });
  const mike = await def("Mike", "Chen", "mike@hexovate.com", "manager", "Engineering Manager", deps.Engineering, priya, {
    orgHidden: false,
    leaveBalanceDays: 20,
  });
  const sarah = await def("Sarah", "Jenkins", "sarah@hexovate.com", "manager", "Marketing Lead", deps.Marketing, alex, {
    orgHidden: false,
    leaveBalanceDays: 18,
  });
  const tom = await def("Tom", "Baxter", "tom@hexovate.com", "employee", "Sales Executive", deps.Marketing, alex, {
    orgHidden: false,
    leaveBalanceDays: 16,
  });
  const jordan = await def("Jordan", "Cole", "jordan@hexovate.com", "employee", "Product Designer", deps.Design, mike, {
    orgHidden: false,
    leaveBalanceDays: 14,
    employmentType: "full_time",
    skills: ["Figma", "Design Systems", "User Research", "Prototyping", "docs:contract", "docs:cnic"],
    emergencyContact: { name: "Riley Cole", phone: "+1 (415) 555-0199" },
    notificationPrefs: { taskAssignments: true, approvalUpdates: true, weeklyDigest: true },
  });
  const david = await def("David", "Kim", "david@hexovate.com", "employee", "Backend Engineer", deps.Engineering, mike, {
    orgHidden: false,
    leaveBalanceDays: 12,
  });
  const rachel = await def("Rachel", "Khan", "rachel@hexovate.com", "employee", "Frontend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 15,
  });
  const sana = await def("Sana", "Khalid", "sana@hexovate.com", "hr", "HR Manager", deps["People Ops"], priya, {
    orgHidden: true,
    leaveBalanceDays: 26,
  });
  const emily = await def("Emily", "Watson", "emily@hexovate.com", "hr", "People Ops Specialist", deps["People Ops"], sana, {
    orgHidden: true,
    leaveBalanceDays: 24,
  });
  const john = await def("John", "Doe", "john@hexovate.com", "manager", "Managing Director", deps.Leadership, priya, {
    orgHidden: true,
    leaveBalanceDays: 28,
  });
  const amelia = await def("Amelia", "Carter", "amelia@hexovate.com", "employee", "Operations Analyst", deps.Finance, priya, {
    orgHidden: true,
    leaveBalanceDays: 17,
  });

  /* ------------------------------------------------------------------
   * Leader-experience demo users (executive / department heads / teams)
   * ------------------------------------------------------------------ */
  // Executive (org-wide analytics)
  const sofia = await def("Sofia", "Reyes", "sofia@hexovate.com", "executive", "Chief Operating Officer", deps.Leadership, priya, {
    orgHidden: false,
    leaveBalanceDays: 30,
    location: "New York, NY",
    joinedAt: addDays(TODAY, -720),
  });

  // Design department head
  const nina = await def("Nina", "Patel", "nina@hexovate.com", "manager", "Head of Design", deps.Design, priya, {
    orgHidden: false,
    leaveBalanceDays: 24,
    joinedAt: addDays(TODAY, -820),
  });
  const leo = await def("Leo", "Fischer", "leo@hexovate.com", "employee", "Junior Designer", deps.Design, nina, {
    orgHidden: true,
    leaveBalanceDays: 15,
    joinedAt: addDays(TODAY, -60),
  });
  const zoe = await def("Zoe", "Park", "zoe@hexovate.com", "employee", "Product Designer", deps.Design, nina, {
    orgHidden: true,
    leaveBalanceDays: 16,
    joinedAt: addDays(TODAY, -170),
  });

  // Engineering — new engineers under Mike (team for the Manager demo)
  const marcus = await def("Marcus", "Lee", "marcus@hexovate.com", "employee", "Backend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 15,
    joinedAt: addDays(TODAY, -200),
    location: "New York, NY",
  });
  const lena = await def("Lena", "Novak", "lena@hexovate.com", "employee", "Frontend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 14,
    joinedAt: addDays(TODAY, -45),
  });
  const andre = await def("Andre", "Hale", "andre@hexovate.com", "employee", "DevOps Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 13,
    joinedAt: addDays(TODAY, -320),
  });
  const priyanka = await def("Priyanka", "Rao", "priyanka@hexovate.com", "employee", "Backend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 14,
    joinedAt: addDays(TODAY, -3),
  });
  const omar = await def("Omar", "Farouk", "omar@hexovate.com", "employee", "Backend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 14,
    joinedAt: addDays(TODAY, -150),
  });
  const hana = await def("Hana", "Kim", "hana@hexovate.com", "employee", "Frontend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    leaveBalanceDays: 15,
    joinedAt: addDays(TODAY, -85),
  });

  // Marketing — Alex's department (Department Head demo)
  const maya = await def("Maya", "Owens", "maya@hexovate.com", "employee", "Content Lead", deps.Marketing, sarah, {
    orgHidden: true,
    leaveBalanceDays: 18,
    joinedAt: addDays(TODAY, -400),
  });
  const noah = await def("Noah", "Pierce", "noah@hexovate.com", "employee", "SEO Specialist", deps.Marketing, sarah, {
    orgHidden: true,
    leaveBalanceDays: 16,
    joinedAt: addDays(TODAY, -140),
  });
  const chloe = await def("Chloe", "Banks", "chloe@hexovate.com", "employee", "Sales Executive", deps.Marketing, alex, {
    orgHidden: true,
    leaveBalanceDays: 14,
    joinedAt: addDays(TODAY, -2),
  });
  const ethan = await def("Ethan", "Ward", "ethan@hexovate.com", "employee", "Social Media Manager", deps.Marketing, sarah, {
    orgHidden: true,
    leaveBalanceDays: 15,
    joinedAt: addDays(TODAY, -230),
  });
  const aisha = await def("Aisha", "Mohammed", "aisha@hexovate.com", "employee", "Sales Executive", deps.Marketing, alex, {
    orgHidden: true,
    leaveBalanceDays: 13,
    joinedAt: addDays(TODAY, -500),
  });

  // Finance
  const daniel = await def("Daniel", "Brooks", "daniel@hexovate.com", "manager", "Head of Finance", deps.Finance, priya, {
    orgHidden: false,
    leaveBalanceDays: 26,
    joinedAt: addDays(TODAY, -700),
  });
  const ashley = await def("Ashley", "Ng", "ashley@hexovate.com", "employee", "Accountant", deps.Finance, daniel, {
    orgHidden: true,
    leaveBalanceDays: 16,
    joinedAt: addDays(TODAY, -90),
  });

  // Recent leavers (turnover analytics)
  await def("Ryan", "Patel", "ryan@hexovate.com", "employee", "Backend Engineer", deps.Engineering, mike, {
    orgHidden: true,
    status: "inactive",
    joinedAt: addDays(TODAY, -600),
    leftAt: addDays(TODAY, -140),
  });
  await def("Grace", "Liu", "grace@hexovate.com", "employee", "Marketing Coordinator", deps.Marketing, alex, {
    orgHidden: true,
    status: "inactive",
    joinedAt: addDays(TODAY, -300),
    leftAt: addDays(TODAY, -60),
  });

  const P = (p) => ({ id: p._id, name: p.name });
  const projects = {};
  const makeProject = async (name, description, status, priority, owner, members, startOffset, dueOffset, budget, spent, progress) => {
    const p = await Project.create({
      name,
      description,
      status,
      priority,
      owner: owner._id,
      members: members.map((m) => m._id),
      startDate: addDays(TODAY, startOffset),
      dueDate: addDays(TODAY, dueOffset),
      budget,
      spent,
      progress,
    });
    projects[name] = p;
    return p;
  };

  await makeProject("Website Redesign", "Full marketing site rebuild with new brand system", "active", "high", alex, [jordan, sarah, david, mike, tom], -24, 21, 50000, 34000, 75);
  await makeProject("ERP Implementation", "Internal rollout of Hexovate modules company-wide", "active", "high", mike, [mike, jordan, david, sana, rachel], -30, 88, 120000, 41000, 30);
  await makeProject("Mobile App v2", "Native app refresh for employee self-service", "on_hold", "medium", mike, [mike, david, rachel], -10, 103, 80000, 36000, 48);
  await makeProject("Q4 Campaign", "Cross-channel product launch campaign", "active", "medium", alex, [sarah, tom, alex], -26, 66, 35000, 24000, 62);
  await makeProject("Vendor Portal", "Self-serve portal for external vendors", "completed", "medium", alex, [alex, tom, david], -100, -26, 40000, 39500, 100);
  await makeProject("Design System 2.0", "Component library and token refresh", "active", "medium", alex, [jordan, david, sarah, mike], -8, 89, 30000, 9000, 40);
  // CEO board — a project closing in ~10 days so "Active Projects" shows a due-soon count
  await makeProject("Board Reporting Upgrade", "Executive dashboards and reporting rollout", "active", "high", priya, [priya, sofia, ravi, daniel], -6, 10, 40000, 12000, 45);

  // Task helpers: due offset in days (0 = today), hour optional.
  const makeTask = async (title, project, assignee, status, priority, dueOffset, { labels = [], description = "", hour = 17, completedOffset = null, backlog = false, createdOffset = null } = {}) => {
    const dueDate = at(addDays(TODAY, dueOffset), hour, 0);
    const t = await Task.create({
      title,
      description,
      project: project._id,
      assignedTo: assignee ? assignee._id : null,
      createdBy: project.owner,
      status,
      priority,
      dueDate,
      labels: backlog ? [...labels, "backlog"] : labels,
      completedAt: completedOffset != null ? at(addDays(TODAY, completedOffset), hour, 5) : null,
    });
    // Spread createdAt into the past (due-relative) so activity feeds look realistic
    // instead of everything reading "just now". Pass createdOffset (days ago) to
    // pin creation to a specific day (e.g. "opened this week" tasks).
    const created = addDays(TODAY, createdOffset != null ? -createdOffset : Math.min(dueOffset, 0) - 10);
    await Task.collection.updateOne({ _id: t._id }, { $set: { createdAt: created, updatedAt: created } });
    return t;
  };

  // ---- Website Redesign tasks (includes the dashboard hero rows) ----
  await makeTask("Review Q3 Marketing Deck", projects["Website Redesign"], jordan, "completed", "high", 0, { labels: ["Design"], description: "Review the Q3 deck before the all-hands.", hour: 10, completedOffset: 0 });
  await makeTask("Client Onboarding: TechNova", projects["Website Redesign"], jordan, "completed", "medium", 0, { labels: ["Design"], hour: 13, completedOffset: 0 });
  await makeTask("Approve pending leave requests", projects["ERP Implementation"], jordan, "todo", "low", 0, { labels: ["Management"], hour: 23 });
  await makeTask("Design pricing page", projects["Website Redesign"], jordan, "in_progress", "medium", 12, { labels: ["Design"], description: "Pricing page with annual/monthly toggle.", hour: 12 });
  await makeTask("Write homepage copy review", projects["Website Redesign"], jordan, "review", "high", 11, { labels: ["Content"], hour: 10 });
  await makeTask("QA mobile breakpoints", projects["Website Redesign"], jordan, "todo", "low", 17, { labels: ["Design"], hour: 12 });
  await makeTask("Update FAQ copy", projects["Website Redesign"], jordan, "todo", "low", 19, { labels: ["Content"], hour: 12 });
  await makeTask("Homepage wireframes", projects["Website Redesign"], jordan, "review", "medium", 9, { labels: ["Design"], hour: 12 });
  await makeTask("Competitor audit", projects["Website Redesign"], tom, "todo", "medium", 15, { labels: ["Research"], hour: 12 });
  await makeTask("SEO keyword list", projects["Website Redesign"], tom, "todo", "medium", 17, { labels: ["Marketing"], hour: 12 });
  await makeTask("Build nav component", projects["Website Redesign"], david, "in_progress", "high", 10, { labels: ["Frontend"], hour: 12 });
  await makeTask("Brand color tokens", projects["Website Redesign"], jordan, "completed", "medium", -25, { labels: ["Design"], hour: 12, completedOffset: -25 });
  await makeTask("Kickoff deck", projects["Website Redesign"], sarah, "completed", "medium", -31, { labels: ["Marketing"], hour: 12, completedOffset: -31 });
  await makeTask("Write homepage copy", projects["Website Redesign"], sarah, "in_progress", "high", 13, { labels: ["Content"], hour: 12 });

  // ---- ERP Implementation ----
  await makeTask("Set up SSO config", projects["ERP Implementation"], jordan, "todo", "high", 15, { labels: ["Frontend"], hour: 12 });
  await makeTask("Migrate employee directory", projects["ERP Implementation"], david, "in_progress", "high", 20, { labels: ["Backend"], hour: 12 });
  await makeTask("Design approval flows", projects["ERP Implementation"], jordan, "review", "medium", 8, { labels: ["Design"], hour: 12 });
  await makeTask("Standup + planning", projects["ERP Implementation"], mike, "completed", "low", -1, { labels: ["Planning"], hour: 9, completedOffset: -1 });
  await makeTask("Data migration dry run", projects["ERP Implementation"], david, "todo", "medium", 26, { labels: ["Backend"], hour: 12 });
  await makeTask("HR module config", projects["ERP Implementation"], sana, "in_progress", "medium", 18, { labels: ["HR"], hour: 12 });

  // ---- Mobile App v2 ----
  await makeTask("App navigation spec", projects["Mobile App v2"], rachel, "review", "medium", 30, { labels: ["Frontend"], hour: 12 });
  await makeTask("Push notification service", projects["Mobile App v2"], david, "todo", "low", 45, { labels: ["Backend"], hour: 12 });
  await makeTask("Offline sync design", projects["Mobile App v2"], jordan, "todo", "medium", 40, { labels: ["Design"], hour: 12 });

  // ---- Q4 Campaign ----
  await makeTask("Campaign landing page", projects["Q4 Campaign"], sarah, "in_progress", "high", 14, { labels: ["Marketing"], hour: 12 });
  await makeTask("Paid media plan", projects["Q4 Campaign"], tom, "review", "medium", 12, { labels: ["Marketing"], hour: 12 });
  await makeTask("Q4 measurement dashboard", projects["Q4 Campaign"], alex, "todo", "medium", 30, { labels: ["Analytics"], hour: 12 });

  // ---- Vendor Portal ----
  await makeTask("Vendor onboarding API", projects["Vendor Portal"], david, "completed", "high", -30, { labels: ["Backend"], hour: 12, completedOffset: -30 });
  await makeTask("Portal UX review", projects["Vendor Portal"], tom, "completed", "medium", -28, { labels: ["Product"], hour: 12, completedOffset: -28 });

  // ---- Design System 2.0 ----
  await makeTask("Token audit", projects["Design System 2.0"], jordan, "in_progress", "medium", 5, { labels: ["Design"], hour: 12 });
  await makeTask("Component QA pass", projects["Design System 2.0"], jordan, "todo", "low", 22, { labels: ["Design"], hour: 12 });
  await makeTask("Storybook setup", projects["Design System 2.0"], david, "in_progress", "low", 18, { labels: ["Frontend"], hour: 12 });
  await makeTask("Icon set refresh", projects["Design System 2.0"], jordan, "completed", "medium", -2, { labels: ["Design"], hour: 12, completedOffset: -2 });
  await makeTask("Typography scale doc", projects["Design System 2.0"], jordan, "completed", "low", -4, { labels: ["Design"], hour: 12, completedOffset: -4 });

  // ---- Time entries (Jordan, current + previous week) ----
  const entries = [];
  const pushEntry = async (dayOffset, project, taskTitle, minutes, billable, { hour = 10, manual = false, user = jordan } = {}) => {
    const date = at(addDays(TODAY, dayOffset), hour, 0);
    const proj = project ? projects[project] : null;
    const t = proj ? await Task.findOne({ project: proj._id, title: taskTitle }).lean() : null;
    const e = await TimeEntry.create({
      user: user._id,
      project: proj ? proj._id : null,
      projectName: proj ? proj.name : "Internal",
      task: t ? t._id : null,
      taskName: taskTitle,
      date,
      startTime: at(date, hour, 0),
      endTime: at(date, hour + Math.max(1, Math.floor(minutes / 60)), minutes % 60),
      duration: minutes,
      billable,
      status: "stopped",
      manual,
    });
    // Backdate createdAt to the entry's own date so the activity feed shows
    // realistic relative times instead of everything reading "just now".
    await TimeEntry.collection.updateOne({ _id: e._id }, { $set: { createdAt: date, updatedAt: date } });
    entries.push(e);
    return e;
  };

  // Current week (Mon → today) — matches the weekly timesheet grid.
  await pushEntry(0, "Website Redesign", "Design pricing page", 135, true, { hour: 9 });
  await pushEntry(0, "ERP Implementation", "Design approval flows", 60, false, { hour: 13 });
  await pushEntry(-1, "Website Redesign", "Homepage wireframes", 80, true, { hour: 10 });
  await pushEntry(-1, "ERP Implementation", "Design approval flows", 45, false, { hour: 15 });
  await pushEntry(-2, "ERP Implementation", "Migrate employee directory", 120, false, { hour: 9 });
  await pushEntry(-2, "Website Redesign", "Design pricing page", 60, true, { hour: 14 });
  await pushEntry(-3, "Design System 2.0", "Token audit", 120, true, { hour: 9 });
  await pushEntry(-3, "Website Redesign", "Review Q3 Marketing Deck", 90, true, { hour: 13 });
  await pushEntry(-4, "Website Redesign", "QA mobile breakpoints", 100, true, { hour: 10 });
  await pushEntry(-4, "ERP Implementation", "Standup + planning", 30, false, { hour: 9, manual: true });
  // Previous week (older entries for the dashboard trend)
  await pushEntry(-7, "Website Redesign", "Brand color tokens", 140, true, { hour: 9 });
  await pushEntry(-7, "Website Redesign", "Homepage wireframes", 70, true, { hour: 14 });
  await pushEntry(-8, "ERP Implementation", "Standup + planning", 25, false, { hour: 9 });
  await pushEntry(-8, "Design System 2.0", "Token audit", 95, true, { hour: 11 });
  await pushEntry(-9, "Website Redesign", "Kickoff deck", 60, false, { hour: 9 });

  // Timesheet docs for Jordan (current week, draft) — and an older submitted one.
  const weekIds = entries.filter((e) => e.date >= monday && e.date < new Date(monday.getTime() + 7 * DAY)).map((e) => e._id);
  await Timesheet.create({ user: jordan._id, weekStart: monday, entries: weekIds, status: "draft", totalHours: 0 });
  const olderWeekStart = new Date(monday.getTime() - 7 * DAY);
  await Timesheet.create({ user: jordan._id, weekStart: olderWeekStart, entries: [], status: "submitted", submittedAt: addDays(TODAY, -3) });

  // ---- Requests (Jordan) ----
  const req = async (requester, type, title, description, reviewer, status, { start, end, amount, response, daysAgo } = {}) => {
    const doc = await Request.create({
      requester: requester._id,
      type,
      title,
      description,
      status,
      reviewer: reviewer ? reviewer._id : null,
      response: response || "",
      startDate: start !== undefined && start !== null ? at(addDays(TODAY, start), 9, 0) : null,
      endDate: end !== undefined && end !== null ? at(addDays(TODAY, end), 18, 0) : null,
      amount: amount ?? null,
    });
    // The timestamps plugin overwrites createdAt — backdate via the raw driver so
    // approval queues and the manager activity feed show realistic relative times.
    if (daysAgo) {
      await Request.collection.updateOne({ _id: doc._id }, { $set: { createdAt: addDays(TODAY, -daysAgo), updatedAt: addDays(TODAY, -daysAgo) } });
    }
    return doc;
  };

  await req(jordan, "leave", "Vacation — Family trip", "Family trip, reachable by email for urgent items.", mike, "pending", { start: 18, end: 22, daysAgo: 7 });
  await req(jordan, "expense", "Client dinner — TechNova", "Dinner with the TechNova onboarding team.", mike, "approved", { start: -9, amount: 146, response: "Approved", daysAgo: 8 });
  await req(jordan, "leave", "Sick day", "Not feeling well.", mike, "approved", { start: -5, end: -5, daysAgo: 5 });
  await req(jordan, "equipment", "Figma seat renewal", "Annual Figma seat renewal for the design team.", mike, "rejected", { amount: 156, response: "Budget cap reached this quarter", daysAgo: 12 });
  await req(jordan, "leave", "Personal day — moving", "Moving apartments, need a personal day.", mike, "pending", { start: 9, end: 9, daysAgo: 1 });
  // Requests for other employees (manager review queues)
  await req(sarah, "expense", "Conference travel — Web Summit", "Flight and hotel for Web Summit.", alex, "pending", { start: 20, amount: 1240, daysAgo: 2 });
  await req(tom, "equipment", "New laptop", "Replacing a 4-year-old laptop.", alex, "pending", { amount: 2400, daysAgo: 1 });

  // ---- Messages ----
  const dm = async (sender, recipient, body, minutesAgo) => {
    const recipients = [sender._id, recipient._id];
    return Message.create({ sender: sender._id, recipients, body, readBy: [sender._id], createdAt: new Date(Date.now() - minutesAgo * 60000) });
  };
  const channel = async (name, sender, body, minutesAgo, { readBy = [] } = {}) =>
    Message.create({
      sender: sender._id,
      recipients: [],
      channelName: name,
      body,
      readBy: readBy.length ? readBy : [sender._id],
      createdAt: new Date(Date.now() - minutesAgo * 60000),
    });

  await channel("design-team", jordan, "Pushed the new design tokens to the shared library 🎨", 200, { readBy: [jordan._id, sarah._id] });
  await channel("design-team", sarah, "Nice, I can see them in Figma already.", 190, { readBy: [jordan._id, sarah._id] });
  await channel("design-team", jordan, "Check #website-redesign for the usage example.", 175, { readBy: [jordan._id, sarah._id] });
  await channel("website-redesign", sarah, "Can we add an annual billing toggle to the pricing page?", 80);
  await channel("website-redesign", jordan, "Yep, adding it to the wireframe now 👍", 60, { readBy: [jordan._id] });
  await channel("website-redesign", sarah, "Perfect, thank you!", 10);
  await channel("announcements", sana, "Office closed Nov 28 — Thanksgiving. NY & Austin offices closed.", 1440);

  await dm(sarah, jordan, "Sending over the homepage wireframe now.", 150, ) && (await dm(jordan, sarah, "Sounds good, thanks!", 140));
  await dm(mike, jordan, "Approved your leave request.", 130);
  await dm(alex, jordan, "Let's sync tomorrow about the Q4 campaign.", 300);
  await dm(priya, jordan, "Great work on the demo!", 400);

  // ---- Announcements ----
  const announce = async (author, title, content, { priority = "normal", hoursAgo = 48, expires = null } = {}) =>
    Announcement.create({
      author: author._id,
      title,
      content,
      audience: "all",
      priority,
      status: "published",
      publishedAt: new Date(Date.now() - hoursAgo * 3600000),
      createdAt: new Date(Date.now() - hoursAgo * 3600000),
      expiresAt: expires,
    });
  await announce(sana, "Office closed Nov 28 — Thanksgiving", "The New York and Austin offices will be closed on Thursday, November 28. Remote employees may also take the day off. Standard holiday schedule applies.", { priority: "important", hoursAgo: 26 });
  await announce(emily, "New expense tool rollout", "Starting next Monday, all expense submissions move to the new module inside My Requests. The old spreadsheet process will be retired.", { hoursAgo: 50 });
  await announce(priya, "Q4 all-hands — Nov 5, 10:00 AM", "Join the full-company update covering roadmap, hiring, and Q4 goals. Calendar invite has been sent to all employees.", { hoursAgo: 120 });

  // ---- Birthdays & anniversaries (HR dashboard widget) ----
  await User.updateOne({ _id: jordan._id }, { $set: { birthDate: new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(new Date().getDate(), 28)) } }); // today
  await User.updateOne({ _id: sana._id }, { $set: { birthDate: addDays(TODAY, 4) } });
  await User.updateOne({ _id: rachel._id }, { $set: { joinedAt: new Date(new Date().getFullYear() - 3, new Date().getMonth(), new Date().getDate() + 2) } }); // 3y anniv. soon

  // ---- Onboarding / Offboarding (HR portal) ----
  const hrDeps = deps;
  const obUser = await def("Noman", "Aziz", "noman@hexovate.com", "employee", "Junior Backend Engineer", hrDeps.Engineering, mike, {
    orgHidden: true,
    joinedAt: addDays(TODAY, -3),
  });
  const obDone = await def("Sarah", "Jamii", "sarahjamii@hexovate.com", "employee", "Content Writer", hrDeps.Marketing, alex, {
    orgHidden: true,
    joinedAt: addDays(TODAY, -9),
  });
  const obSoon = await def("Kashif", "Hameed", "kashif@hexovate.com", "employee", "Sales Executive", hrDeps.Marketing, alex, {
    orgHidden: true,
    joinedAt: addDays(TODAY, 4),
  });
  const obSteps = (n) => ONBOARDING_STEPS.map((label, i) => ({ label, done: i < n }));
  await OnboardingRecord.create({
    user: obUser._id,
    jobTitle: "Junior Backend Engineer",
    department: hrDeps.Engineering,
    startDate: addDays(TODAY, -3),
    steps: obSteps(6),
    status: "in_progress",
    createdBy: sana._id,
  });
  await DocumentModel.create([
    { employee: jordan._id, title: "Employment Contract", fileName: "Employment Contract.pdf", category: "contract", uploadedBy: sana._id, uploadedAt: addDays(TODAY, -800) },
    { employee: jordan._id, title: "NDA - Signed", fileName: "NDA - Signed.pdf", category: "contract", uploadedBy: sana._id, uploadedAt: addDays(TODAY, -790) },
    { employee: jordan._id, title: "ID Verification", fileName: "ID Verification.pdf", category: "id", uploadedBy: sana._id, uploadedAt: addDays(TODAY, -780) },
    { employee: jordan._id, title: "Performance Review 2025", fileName: "Performance Review 2025.pdf", category: "review", uploadedBy: sana._id, uploadedAt: addDays(TODAY, -230) },
    { employee: jordan._id, title: "Tax Form W-4", fileName: "Tax Form W-4.pdf", category: "tax", uploadedBy: sana._id, uploadedAt: addDays(TODAY, -795) },
  ]);
  await OnboardingRecord.create({
    user: obDone._id,
    jobTitle: "Content Writer",
    department: hrDeps.Marketing,
    startDate: addDays(TODAY, -9),
    steps: obSteps(9),
    status: "complete",
    createdBy: sana._id,
  });
  await OnboardingRecord.create({
    user: obSoon._id,
    jobTitle: "Sales Executive",
    department: hrDeps.Marketing,
    startDate: addDays(TODAY, 4),
    steps: obSteps(2),
    status: "not_started",
    createdBy: sana._id,
  });
  const offUser = await def("Kamran", "Butt", "kamran@hexovate.com", "employee", "Marketing Executive", hrDeps.Marketing, alex, {
    orgHidden: true,
    status: "inactive",
    leaveBalanceDays: 0,
  });
  const offUser2 = await def("Sania", "Waqar", "sania@hexovate.com", "employee", "QA Analyst", hrDeps.Engineering, mike, {
    orgHidden: true,
    status: "inactive",
    leaveBalanceDays: 0,
  });
  const offSteps = (n) => OFFBOARDING_STEPS.map((label, i) => ({ label, done: i < n }));
  await OffboardingRecord.create({
    user: offUser._id,
    jobTitle: "Marketing Executive",
    department: hrDeps.Marketing,
    lastWorkingDay: addDays(TODAY, -8),
    reason: "Resignation",
    steps: offSteps(5),
    status: "in_progress",
    createdBy: sana._id,
  });
  await OffboardingRecord.create({
    user: offUser2._id,
    jobTitle: "QA Analyst",
    department: hrDeps.Engineering,
    lastWorkingDay: addDays(TODAY, 3),
    reason: "Contract End",
    steps: offSteps(1),
    status: "in_progress",
    createdBy: sana._id,
  });

  // ---- Notifications (Jordan) ----
  const notif = (user, type, title, message, minutesAgo, read = false) =>
    Notification.create({ user: user._id, type, title, message, read, createdAt: new Date(Date.now() - minutesAgo * 60000) });
  await notif(jordan, "task", "Task assigned to you", 'Sarah assigned "Update FAQ copy"', 10);
  await notif(jordan, "approval", "Leave request approved", "Oct 21–25 vacation approved", 60);
  await notif(jordan, "mention", "New mention", "Sarah mentioned you in #website-redesign", 120);
  await notif(jordan, "announcement", "New announcement", "Office closed Nov 28", 1440);
  await notif(jordan, "task", "Task completed 🎉", "You completed Review Q3 Marketing Deck", 30, true);
  await notif(jordan, "approval", "Expense approved", "$146 client dinner approved", 600, true);
  await notif(sarah, "approval", "Timesheet approved", "Your timesheet was approved", 240, true);
  await notif(mike, "system", "New pending requests", "2 requests await your review", 45);
  await notif(alex, "system", "New pending requests", "2 requests await your review", 30);

  /* ------------------------------------------------------------------
   * Team / department task load (Manager, Department Head and Reports)
   * ------------------------------------------------------------------ */
  await makeTask("Database sharding plan", projects["ERP Implementation"], marcus, "todo", "high", 12, { labels: ["Backend"], hour: 12 });
  await makeTask("Backup strategy review", projects["ERP Implementation"], andre, "in_progress", "medium", 8, { labels: ["DevOps"], hour: 12 });
  await makeTask("Migrate CI to GitHub Actions", projects["Mobile App v2"], andre, "todo", "low", 20, { labels: ["DevOps"], hour: 12 });
  await makeTask("Empty states UI kit", projects["Design System 2.0"], rachel, "review", "medium", 7, { labels: ["Frontend"], hour: 12 });
  await makeTask("Component docs pass", projects["Design System 2.0"], lena, "in_progress", "medium", 14, { labels: ["Frontend"], hour: 12 });
  await makeTask("Error tracking setup", projects["ERP Implementation"], priyanka, "in_progress", "medium", 4, { labels: ["Backend"], hour: 12 });
  await makeTask("Rate-limit middleware", projects["Mobile App v2"], david, "completed", "medium", -40, { labels: ["Backend"], hour: 12, completedOffset: -40 });
  await makeTask("Drawer accessibility pass", projects["Design System 2.0"], rachel, "completed", "low", -16, { labels: ["Frontend"], hour: 12, completedOffset: -16 });
  await makeTask("Font loading audit", projects["Design System 2.0"], lena, "completed", "medium", -62, { labels: ["Frontend"], hour: 12, completedOffset: -62 });
  await makeTask("Test coverage report", projects["ERP Implementation"], marcus, "completed", "low", -3, { labels: ["Backend"], hour: 12, completedOffset: -3 });
  await makeTask("Icon usage audit", projects["Design System 2.0"], zoe, "completed", "low", -20, { labels: ["Design"], hour: 12, completedOffset: -20 });
  await makeTask("Component explorer setup", projects["Design System 2.0"], hana, "completed", "low", -48, { labels: ["Frontend"], hour: 12, completedOffset: -48 });
  await makeTask("Landing page experiments", projects["Q4 Campaign"], maya, "in_progress", "high", 10, { labels: ["Marketing"], hour: 12 });
  await makeTask("Search console audit", projects["Q4 Campaign"], noah, "review", "medium", 6, { labels: ["Marketing"], hour: 12 });
  await makeTask("Productboard import", projects["Website Redesign"], maya, "completed", "low", -22, { labels: ["Marketing"], hour: 12, completedOffset: -22 });
  await makeTask("Social launch calendar", projects["Q4 Campaign"], ethan, "in_progress", "medium", 9, { labels: ["Marketing"], hour: 12 });
  await makeTask("Champion onboarding emails", projects["Q4 Campaign"], ethan, "todo", "medium", 15, { labels: ["Marketing"], hour: 12 });
  await makeTask("Enablement deck", projects["ERP Implementation"], chloe, "todo", "medium", 18, { labels: ["Sales"], hour: 12 });
  await makeTask("Sales collateral refresh", projects["Q4 Campaign"], aisha, "in_progress", "low", 13, { labels: ["Sales"], hour: 12 });
  await makeTask("KPI dashboard spec", projects["ERP Implementation"], daniel, "todo", "medium", 21, { labels: ["Finance"], hour: 12 });

  // ---- Manager (Team Lead) dashboard demo — tasks due today / overdue ----
  await makeTask("Fix pagination bug on contacts table", projects["Website Redesign"], david, "in_progress", "high", 0, { labels: ["Frontend"], hour: 16 });
  await makeTask("Validate schema migration on staging", projects["ERP Implementation"], andre, "in_progress", "medium", 0, { labels: ["Backend"], hour: 16 });
  await makeTask("Review PR #482 — contact merge logic", projects["Website Redesign"], hana, "review", "high", 0, { labels: ["Frontend"], hour: 15 });
  await makeTask("Archive completed deal records", projects["Website Redesign"], david, "todo", "medium", -1, { labels: ["Maintenance"], hour: 9 });
  // Opened this week so the "Active Tasks ▲ N this week" trend chip shows (Figma hero row).
  await makeTask("Set up staging environment", projects["Website Redesign"], david, "in_progress", "high", 6, { labels: ["Frontend"], hour: 10, createdOffset: 2 });
  await makeTask("Contact list export", projects["ERP Implementation"], andre, "todo", "medium", 7, { labels: ["Backend"], hour: 11, createdOffset: 3 });
  await makeTask("Payment reminder email", projects["ERP Implementation"], priyanka, "in_progress", "medium", 8, { labels: ["Backend"], hour: 14, createdOffset: 1 });
  await makeTask("Fix flash on theme switch", projects["Website Redesign"], hana, "review", "high", 5, { labels: ["Frontend"], hour: 12, createdOffset: 4 });

  // ---- Manager (Team Lead) dashboard demo — team time entries (this + last week) ----
  const teamEntries = [
    [david, "Website Redesign", "Build nav component", 210, true, 0, 9],
    [david, "ERP Implementation", "Migrate employee directory", 185, true, -1, 10],
    [rachel, "Mobile App v2", "App navigation spec", 195, true, 0, 11],
    [marcus, "ERP Implementation", "Database sharding plan", 240, true, -1, 9],
    [lena, "Design System 2.0", "Component docs pass", 165, true, 0, 10],
    [andre, "ERP Implementation", "Backup strategy review", 185, true, -2, 9],
    [priyanka, "ERP Implementation", "Error tracking setup", 175, true, -1, 11],
    [hana, "Design System 2.0", "Component explorer setup", 150, true, -2, 14],
    [omar, "ERP Implementation", "Standup + planning", 30, false, -2, 9],
    // previous week (hours delta)
    [david, "ERP Implementation", "Migrate employee directory", 200, true, -7, 9],
    [rachel, "Mobile App v2", "App navigation spec", 175, true, -7, 10],
    [marcus, "ERP Implementation", "Database sharding plan", 230, true, -8, 9],
    [lena, "Design System 2.0", "Component docs pass", 155, true, -7, 11],
    [andre, "ERP Implementation", "Backup strategy review", 190, true, -8, 10],
    [priyanka, "ERP Implementation", "Error tracking setup", 165, true, -7, 9],
    [hana, "Design System 2.0", "Component explorer setup", 140, true, -8, 14],
    [omar, "ERP Implementation", "Standup + planning", 25, false, -7, 9],
  ];
  for (const [user, projectName, taskTitle, minutes, billable, dayOffset, hour] of teamEntries) {
    await pushEntry(dayOffset, projectName, taskTitle, minutes, billable, { hour, user });
  }

  /* ------------------------------------------------------------------
   * Leave + approval queues (attendance 'on leave', Manager/Head views)
   * ------------------------------------------------------------------ */
  const leaveSeed = [];
  const pushLeave = async (requester, title, reviewer, status, start, end, extra = {}) => {
    const row = await req(requester, "leave", title, extra.description || "", reviewer, status, {
      start,
      end,
      response: extra.response || (status === "approved" ? "Approved" : status === "rejected" ? "Not approved" : ""),
      daysAgo: extra.daysAgo ?? (status === "pending" ? 1 : Math.max(1, Math.abs(start) + 1)),
    });
    if (status === "approved") leaveSeed.push(row);
    return row;
  };

  // historical approved leaves (leave trends + usage)
  await pushLeave(tom, "Family week", alex, "approved", -44, -40, { response: "Enjoy!" });
  await pushLeave(sarah, "Summer break", alex, "approved", -70, -66);
  await pushLeave(jordan, "Long weekend — lake house", mike, "approved", -88, -86, { daysAgo: 89 });
  await pushLeave(david, "Conference leave", mike, "approved", -52, -50);
  await pushLeave(rachel, "Wellness days", mike, "approved", -20, -20);
  await pushLeave(david, "Sick day", mike, "approved", -12, -12, { description: "Flu" });
  await pushLeave(zoe, "City trip", nina, "approved", -14, -13);
  await pushLeave(leo, "Personal day", nina, "approved", -30, -30);
  await pushLeave(ethan, "Family event", sarah, "approved", -33, -30);
  await pushLeave(ashley, "Dentist appointment", daniel, "approved", -5, -5);
  // recent approved leave (some covering today so dashboards show 'on leave')
  await pushLeave(maya, "Staycation", sarah, "approved", 0, 2, { daysAgo: 10 });
  await pushLeave(amelia, "Personal leave", priya, "approved", 0, 1, { daysAgo: 5 });
  await pushLeave(noah, "Moving apartments", sarah, "approved", -2, -1, { daysAgo: 3 });
  await pushLeave(priyanka, "Onboarding leave", mike, "approved", -3, -3, { daysAgo: 4 });
  await pushLeave(lena, "Long weekend", mike, "approved", -6, -4, { daysAgo: 8 });
  await pushLeave(omar, "Personal day", mike, "approved", 0, 0, { daysAgo: 2, response: "Take the time you need" });
  await pushLeave(aisha, "Family celebration", alex, "approved", -9, -8, { daysAgo: 12 });
  await pushLeave(jordan, "Sick day", mike, "approved", -5, -5, { daysAgo: 5, response: "Feel better" });
  // pending leave (approval queues for Mike / Alex / Nina / Daniel)
  await pushLeave(marcus, "Travel plans", mike, "pending", 5, 7, { daysAgo: 2 });
  await pushLeave(david, "Family visit", mike, "pending", 15, 16, { daysAgo: 2 });
  await pushLeave(priyanka, "Diwali break", mike, "pending", 24, 26, { daysAgo: 1 });
  await pushLeave(hana, "Personal day", mike, "pending", 11, 11, { daysAgo: 2 });
  await pushLeave(chloe, "Weekend away", sarah, "pending", 6, 8, { daysAgo: 3 });
  await pushLeave(ethan, "Wedding", alex, "pending", 12, 12, { daysAgo: 1 });
  await pushLeave(tom, "Family trip", alex, "pending", 20, 22, { daysAgo: 2 });
  await pushLeave(noah, "Doctor appointment", sarah, "pending", 9, 9, { daysAgo: 1 });
  await pushLeave(leo, "Studio visit", nina, "pending", 13, 13, { daysAgo: 1 });
  await pushLeave(zoe, "Personal day", nina, "pending", 18, 18, { daysAgo: 1 });
  await pushLeave(ashley, "Family event", daniel, "pending", 10, 12, { daysAgo: 2 });
  // rejected leaves with reasons (history)
  await pushLeave(noah, "Sick day — no notice", sarah, "rejected", -18, -18, { daysAgo: 18, response: "Please give more notice for sick leave." });
  await pushLeave(ethan, "Extra vacation day", alex, "rejected", -12, -12, { daysAgo: 12, response: "Above quota for the quarter." });
  await pushLeave(tom, "Weekend extension", alex, "rejected", -26, -26, { daysAgo: 26, response: "Coverage conflict." });

  // extra non-leave requests to fill the review queues
  await req(chloe, "equipment", "Standing desk", "Ergonomic desk for the home office.", alex, "pending", { amount: 420, daysAgo: 3 });
  await req(maya, "expense", "Team offsite lunch", "Lunch for the content team.", sarah, "pending", { amount: 185, daysAgo: 2 });
  await req(david, "expense", "Cloud conference ticket", "Annual infrastructure conference.", mike, "pending", { amount: 640, daysAgo: 4 });
  await req(marcus, "equipment", "Second monitor", "4K display for debugging.", mike, "pending", { amount: 320, daysAgo: 1 });
  await req(ethan, "expense", "Ads platform top-up", "Meta ads credit.", alex, "pending", { amount: 900, daysAgo: 5 });
  await req(noah, "permission", "Remote week", "Working remotely while visiting family.", sarah, "approved", { start: -7, end: -3, daysAgo: 8, response: "OK" });

  // Recompute annual leave balances after approved usage
  const usedBy = {};
  for (const l of leaveSeed) {
    const uid = String(l.requester);
    const days = Math.max(1, Math.round((new Date(l.endDate || l.startDate).getTime() - new Date(l.startDate).getTime()) / DAY) + 1);
    usedBy[uid] = (usedBy[uid] || 0) + days;
  }
  for (const [uid, days] of Object.entries(usedBy)) {
    await User.updateOne({ _id: uid }, { $max: { leaveBalanceDays: 4 } }).then(() =>
      User.updateOne({ _id: uid }, { $inc: { leaveBalanceDays: -days } })
    );
  }

  /* ------------------------------------------------------------------
   * Attendance — ~120 workdays per tracked employee (deterministic)
   * ------------------------------------------------------------------ */
  const hashNum = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const rand = (s) => (hashNum(s) % 1000) / 1000;

  const tracked = [priya, ravi, nadia, alex, mike, sarah, tom, jordan, david, rachel, sana, emily, john, amelia, nina, leo, zoe, marcus, lena, andre, priyanka, omar, hana, maya, noah, chloe, ethan, aisha, daniel, ashley];
  const leaveMap = new Map();
  for (const l of leaveSeed) {
    const uid = String(l.requester);
    if (!leaveMap.has(uid)) leaveMap.set(uid, []);
    leaveMap.get(uid).push({ from: new Date(l.startDate), to: new Date(l.endDate || l.startDate) });
  }
  const covers = (uid, d) => {
    const list = leaveMap.get(uid);
    if (!list) return false;
    return list.some((w) => d >= w.from && d <= w.to);
  };
  const clockAt = (d, totalMins) => {
    const x = new Date(d.getTime());
    x.setHours(Math.floor(totalMins / 60), totalMins % 60, 0, 0);
    return x;
  };

  const attDocs = [];
  for (let i = 120; i >= 0; i -= 1) {
    const d = addDays(TODAY, -i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    for (const u of tracked) {
      const uid = String(u._id);
      const iso = d.toISOString().slice(0, 10);
      if (covers(uid, d)) {
        attDocs.push({ user: u._id, date: d, status: "leave" });
        continue;
      }
      const r = rand(uid + iso);
      let status = "present";
      let totalMins = 510 + Math.floor(rand(uid + "in" + iso) * 35); // 8:30–9:05
      let hours = 8.2 + Math.floor(rand(uid + "h" + iso) * 8) / 10;
      if (r < 0.03) {
        status = "absent";
        totalMins = 0;
        hours = 0;
      } else if (r < 0.09) {
        status = "late";
        totalMins = 555 + Math.floor(rand(uid + "late" + iso) * 65); // 9:15–10:20
        hours = 7.1;
      }
      attDocs.push({
        user: u._id,
        date: d,
        status,
        clockIn: totalMins ? clockAt(d, totalMins) : null,
        hours,
      });
    }
  }
  await Attendance.insertMany(attDocs, { ordered: false });

  /* ------------------------------------------------------------------
   * Performance reviews — completed past cycles + current cycle states
   * ------------------------------------------------------------------ */
  const qLabel = (back) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3 * back);
    return d.getFullYear() + "-Q" + (Math.floor(d.getMonth() / 3) + 1);
  };
  const qStart = (back) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3 * back);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const ratingOf = (score) => (score >= 90 ? "Outstanding" : score >= 80 ? "Exceeds expectations" : score >= 70 ? "Meets expectations" : score >= 60 ? "Developing" : "Needs improvement");
  const goalPool = [
    "Ship the top quarterly priority",
    "Raise code review participation",
    "Improve cross-team communication",
    "Hit the department OKR target",
    "Mentor a junior teammate",
    "Reduce defect escape rate",
    "Lead the monthly demo",
    "Complete the onboarding refresh",
  ];
  const perfDocs = [];
  for (const u of tracked) {
    const uid = String(u._id);
    const joined = new Date(u.joinedAt);
    const score = 55 + (hashNum(uid + "perf") % 43);
    const reviewer = u.manager || priya._id;
    for (const back of [1, 2]) {
      if (joined > qStart(back)) continue;
      const goals = [goalPool[hashNum(uid + "g" + back) % goalPool.length], goalPool[hashNum(uid + "gg" + back) % goalPool.length]];
      perfDocs.push({
        user: u._id,
        reviewer,
        period: qLabel(back),
        score,
        rating: ratingOf(score),
        goals,
        feedback: "Strong performance this cycle. Keep delivering on priorities and sharing knowledge across the team.",
        status: "completed",
        reviewDate: addDays(qStart(back), 40 + (hashNum(uid + "rd" + back) % 20)),
      });
    }
    const cycle = hashNum(uid + "cyc") % 10;
    if (cycle < 4) {
      perfDocs.push({ user: u._id, reviewer, period: qLabel(0), score: 0, rating: "", goals: [], feedback: "", status: "draft", reviewDate: null });
    } else if (cycle < 7) {
      const s = Math.max(55, Math.min(97, score + (cycle % 3 === 0 ? 3 : -2)));
      perfDocs.push({
        user: u._id,
        reviewer,
        period: qLabel(0),
        score: s,
        rating: ratingOf(s),
        goals: [goalPool[hashNum(uid + "q3") % goalPool.length]],
        feedback: "Mid-cycle check-in complete — tracking well.",
        status: "in_review",
        reviewDate: addDays(TODAY, 12 + (hashNum(uid + "q3d") % 15)),
      });
    }
  }
  await PerformanceReview.insertMany(perfDocs, { ordered: false });

  /* ------------------------------------------------------------------
   * Payroll — last 6 months per tracked employee
   * ------------------------------------------------------------------ */
  const annualFor = (u) => {
    const t = ((u.jobTitle || "") + " " + (u.role || "")).toLowerCase();
    if (t.indexOf("chief") >= 0 || t.indexOf("head of") >= 0 || t.indexOf("executive") >= 0 || t.indexOf("vp") >= 0) return 170000 + (hashNum(String(u._id) + "sal") % 60000);
    if (u.role === "manager") return 120000 + (hashNum(String(u._id) + "sal") % 40000);
    if (u.role === "hr") return 90000 + (hashNum(String(u._id) + "sal") % 20000);
    if (t.indexOf("engineer") >= 0) return 95000 + (hashNum(String(u._id) + "sal") % 35000);
    if (t.indexOf("designer") >= 0) return 90000 + (hashNum(String(u._id) + "sal") % 25000);
    if (t.indexOf("sales") >= 0) return 85000 + (hashNum(String(u._id) + "sal") % 30000);
    return 70000 + (hashNum(String(u._id) + "sal") % 30000);
  };
  const payMonths = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    payMonths.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  }
  const payDocs = [];
  for (const u of tracked) {
    const base = Math.round(annualFor(u) / 12 / 10) * 10;
    const allowances = Math.round(base * 0.1);
    const deductions = Math.round((base + allowances) * 0.22 + 150);
    const net = base + allowances - deductions;
    for (const key of payMonths) {
      payDocs.push({ user: u._id, month: key, base, allowances, deductions, net, status: key === payMonths[payMonths.length - 1] ? "processing" : "paid" });
    }
  }
  await PayrollRecord.insertMany(payDocs, { ordered: false });

  /* ------------------------------------------------------------------
   * Recruitment — open / on-hold / closed positions
   * ------------------------------------------------------------------ */
  await JobPosting.insertMany(
    [
      { title: "Senior Backend Engineer", department: deps.Engineering._id, departmentName: "Engineering", openings: 2, applicants: 34, hired: 0, status: "open", postedAt: addDays(TODAY, -45) },
      { title: "Frontend Engineer", department: deps.Engineering._id, departmentName: "Engineering", openings: 1, applicants: 22, hired: 0, status: "open", postedAt: addDays(TODAY, -60) },
      { title: "DevOps Engineer", department: deps.Engineering._id, departmentName: "Engineering", openings: 1, applicants: 9, hired: 0, status: "on_hold", postedAt: addDays(TODAY, -110) },
      { title: "Growth Marketer", department: deps.Marketing._id, departmentName: "Marketing", openings: 1, applicants: 14, hired: 0, status: "open", postedAt: addDays(TODAY, -20) },
      { title: "Content Strategist", department: deps.Marketing._id, departmentName: "Marketing", openings: 1, applicants: 40, hired: 1, status: "closed", postedAt: addDays(TODAY, -200), closedAt: addDays(TODAY, -80) },
      { title: "Product Designer", department: deps.Design._id, departmentName: "Design", openings: 1, applicants: 26, hired: 0, status: "open", postedAt: addDays(TODAY, -30) },
      { title: "Finance Analyst", department: deps.Finance._id, departmentName: "Finance", openings: 1, applicants: 9, hired: 0, status: "open", postedAt: addDays(TODAY, -15) },
      { title: "HR Business Partner", department: deps["People Ops"]._id, departmentName: "People Ops", openings: 1, applicants: 18, hired: 1, status: "closed", postedAt: addDays(TODAY, -240), closedAt: addDays(TODAY, -120) },
    ],
    { ordered: false }
  );

  /* ------------------------------------------------------------------
   * Platform (Super Admin) — tenant companies, audit trail, tickets
   * ------------------------------------------------------------------ */
  // Bypass the mongoose timestamps plugin: write createdAt via the raw driver so
  // seeded history (signup trends, "x min ago" activity) lands on real dates.
  const backdate = async (Model, id, created, updated) =>
    Model.collection.updateOne({ _id: id }, { $set: { createdAt: created, updatedAt: updated || created } });
  const mkCompany = async (name, domain, industry, plan, status, seats, used, contact, email, renewalDays, joinedDays) => {
    const c = await Company.create({ name, domain, industry, plan, status, seats, seatsUsed: used, contactName: contact, contactEmail: email, renewalDate: addDays(TODAY, renewalDays) });
    await backdate(Company, c._id, addDays(TODAY, -joinedDays));
    return c;
  };

  await mkCompany("Hexovate Inc.", "hexovate.com", "Enterprise Software", "enterprise", "active", 340, 312, "Amelia Carter", "amelia@hexovate.com", 12, 700);
  await mkCompany("Acme Labs", "acmelabs.io", "Developer Tools", "enterprise", "active", 120, 98, "Dana Whitfield", "dana@acmelabs.io", 45, 260);
  await mkCompany("TechNova", "technova.co", "Cloud Infrastructure", "business", "active", 60, 44, "Carlos Mendes", "carlos@technova.co", 30, 420);
  await mkCompany("Northstar", "northstar.ai", "AI / ML", "business", "active", 48, 41, "Nina Petrova", "nina@northstar.ai", 22, 380);
  await mkCompany("Cloudline", "cloudline.dev", "SaaS Analytics", "enterprise", "active", 200, 177, "Erin Cole", "erin@cloudline.dev", 40, 540);
  await mkCompany("Harborview", "harborview.com", "Logistics", "enterprise", "active", 150, 131, "Tom Whitaker", "tom@harborview.com", 50, 470);
  await mkCompany("Jupiter Systems", "jupitersys.com", "Hardware", "enterprise", "active", 95, 80, "Nick Roman", "nick@jupitersys.com", 55, 610);
  await mkCompany("DataPeak", "datapeak.io", "Data Platforms", "business", "active", 35, 28, "Samuel Okafor", "sam@datapeak.io", 25, 200);
  await mkCompany("Evergreen", "evergreen.co", "Sustainability", "business", "active", 40, 33, "Lena Meyer", "lena@evergreen.co", 35, 320);
  await mkCompany("FusionWorks", "fusionworks.app", "Collaboration", "business", "active", 26, 21, "Diego Alvarez", "diego@fusionworks.app", 18, 150);
  await mkCompany("InnoSquare", "innosquare.io", "EdTech", "business", "active", 30, 24, "Ana Duarte", "ana@innosquare.io", 28, 240);
  await mkCompany("Lumina Health", "luminahealth.com", "HealthTech", "business", "active", 55, 47, "Grace Adeyemi", "grace@luminahealth.com", 31, 290);
  await mkCompany("Brightpath", "brightpath.co", "FinTech", "trial", "trial", 12, 5, "Omar Siddiqui", "omar@brightpath.co", 14, 30);
  await mkCompany("GreenGate", "greengate.eco", "Clean Energy", "trial", "trial", 10, 4, "Priya Shah", "priya@greengate.eco", 12, 18);
  await mkCompany("Kinetic Labs", "kineticlabs.dev", "Gaming", "trial", "trial", 8, 6, "Mia Chen", "mia@kineticlabs.dev", 9, 6);

  const mkAudit = async (category, action, targetType, targetName, detail, minsAgo) => {
    const a = await AuditLog.create({ actor: "Nadia Haddad", category, action, targetType, targetName, detail });
    await backdate(AuditLog, a._id, new Date(Date.now() - minsAgo * 60000));
    return a;
  };
  await mkAudit("company", "Company created", "company", "Acme Labs", "Acme Labs joined on the Enterprise plan", 10);
  await mkAudit("subscription", "Plan upgraded", "company", "TechNova", "Business → Enterprise", 60);
  await mkAudit("security", "Member suspended", "company", "Northstar", "2 seats suspended after payment failure", 120);
  await mkAudit("billing", "Invoice paid", "company", "Hexovate Inc.", "Invoice #INV-2041 paid — $18,900", 300);
  await mkAudit("support", "Ticket resolved", "ticket", "SSO sync failure", "Acme Labs · resolved by Tier-1", 420);
  await mkAudit("company", "Company created", "company", "DataPeak", "DataPeak joined on the Business plan", 1440);
  await mkAudit("subscription", "Seats increased", "company", "Jupiter Systems", "+12 seats added to Enterprise plan", 2880);
  await mkAudit("security", "Admin added", "company", "Evergreen", "Ops lead granted company-admin role", 4320);  await mkAudit("billing", "Invoice overdue", "company", "Kinetic Labs", "Invoice #INV-2033 is 2 days late", 1560);
  await mkAudit("company", "Company created", "company", "Brightpath", "Brightpath started a 14-day trial", 7200);
  await mkAudit("subscription", "Plan downgraded", "company", "Northstar", "Enterprise → Business", 8640);
  await mkAudit("support", "Ticket opened", "ticket", "API rate limit errors", "Meridian · high priority", 240);

  const mkTicket = async (companyName, subject, description, priority, status, reporter, minsAgo, assignee = "") => {
    const c = await Company.findOne({ name: companyName }).lean();
    const t = await SupportTicket.create({ company: c ? c._id : null, companyName, subject, description, priority, status, reporter, assignee });
    await backdate(SupportTicket, t._id, new Date(Date.now() - minsAgo * 60000));
    return t;
  };
  await mkTicket("Acme Labs", "SSO sync failures for new hires", "New hires are intermittently failing to provision in Okta after invite.", "critical", "open", "Dana Whitfield", 130);
  await mkTicket("TechNova", "Invoice discrepancy on Enterprise plan", "Charged for 60 seats but renewal shows 44 active users.", "high", "open", "Carlos Mendes", 300);
  await mkTicket("Northstar", "Suspension not applied", "Two suspended members still have active sessions.", "high", "in_progress", "Nina Petrova", 1440, "Nadia Haddad");
  await mkTicket("Brightpath", "Help with onboarding", "Need a walkthrough of roles and permissions for our pilot.", "medium", "open", "Omar Siddiqui", 200);
  await mkTicket("DataPeak", "Billing portal export broken", "CSV export returns 500 for October invoices.", "medium", "resolved", "Samuel Okafor", 2900);
  await mkTicket("Lumina Health", "Seat limit question", "What happens when usage exceeds the Business plan seats?", "low", "closed", "Grace Adeyemi", 8600);

  /* ------------------------------------------------------------------
   * Billing — invoices for Billing & Payments / Invoice Detail pages
   * ------------------------------------------------------------------ */
  const mkInvoice = async (num, companyName, plan, amount, status, issuedDaysAgo, method = "") => {
    const c = await Company.findOne({ name: companyName }).lean();
    if (!c) return null;
    const inv = await Invoice.create({
      number: num,
      company: c._id,
      plan,
      amount,
      status,
      issuedAt: addDays(TODAY, -issuedDaysAgo),
      dueAt: addDays(TODAY, -issuedDaysAgo + 30),
      paidAt: status === "paid" ? addDays(TODAY, -issuedDaysAgo + 4) : null,
      paymentMethod: method,
    });
    return inv;
  };
  await mkInvoice("INV-1048", "Hexovate Inc.", "enterprise", 990, "paid", 6, "Card ending 4242");
  await mkInvoice("INV-1047", "Acme Labs", "enterprise", 990, "paid", 9, "ACH transfer");
  await mkInvoice("INV-1046", "TechNova", "business", 499, "paid", 12, "Card ending 1881");
  await mkInvoice("INV-1045", "Cloudline", "enterprise", 990, "paid", 15, "Wire");
  await mkInvoice("INV-1044", "Harborview", "enterprise", 990, "open", 3);
  await mkInvoice("INV-1043", "DataPeak", "business", 499, "overdue", 40);
  await mkInvoice("INV-1042", "Jupiter Systems", "enterprise", 990, "paid", 20, "Card ending 7301");
  await mkInvoice("INV-1041", "Lumina Health", "business", 499, "paid", 24, "ACH transfer");

  /* ------------------------------------------------------------------
   * Access control — role templates
   * ------------------------------------------------------------------ */
  await RoleTemplate.create([
    { name: "Employee", description: "Self-service only: personal dashboard, tasks, requests, profile.", permissions: ["dashboard.view", "tasks.own", "requests.create", "profile.edit"], system: true },
    { name: "Manager", description: "Team lead: direct reports, task assignment, team approvals.", permissions: ["dashboard.team", "people.team", "tasks.assign", "requests.decide", "performance.write"], system: true },
    { name: "HR", description: "People operations: org-wide directory, lifecycle, attendance & payroll.", permissions: ["people.org", "lifecycle.manage", "attendance.manage", "payroll.view", "announcements.publish"], system: true },
    { name: "Executive", description: "Read-only org oversight: KPIs, reports, departments, approvals inbox.", permissions: ["dashboard.org", "people.org.readonly", "reports.org", "departments.view"], system: true },
    { name: "CEO", description: "Company leadership: strategic board, org-wide analytics, priorities.", permissions: ["dashboard.org", "people.org.readonly", "reports.org", "priorities.manage"], system: true },
    { name: "Company Admin", description: "Runs the company: users, roles, departments and approvals.", permissions: ["people.org", "users.manage", "departments.manage", "requests.decide", "announcements.publish"], system: true },
  ]);

  /* ------------------------------------------------------------------
   * CEO board — strategic initiatives + monthly revenue series
   * ------------------------------------------------------------------ */
  const mkInitiative = async (title, area, dueDays, status, description) => {
    const doc = await Initiative.create({ title, area, description, status, dueDate: addDays(TODAY, dueDays) });
    return doc;
  };
  // createdAt is backdated (ascending = Figma display order) via the raw driver,
  // mirroring how requests/companies backdate their history.
  const initiatives = [
    { title: "Approve annual budget", area: "Finance", status: "pending", due: 45, description: "Review and approve the FY budget proposal before the board meeting." },
    { title: "Review hiring plan", area: "HR", status: "review", due: 43, description: "Validate next quarter headcount plan and open roles." },
    { title: "ERP rollout", area: "IT", status: "healthy", due: 101, description: "Company-wide rollout of the ERP modules is tracking to plan." },
    { title: "Q4 strategy", area: "Leadership", status: "draft", due: 50, description: "Draft the Q4 strategy and OKRs for the leadership team." },
    { title: "Website redesign launch", area: "Marketing", status: "at_risk", due: 12, description: "Public launch of the rebuilt marketing site — date is slipping." },
    { title: "Mobile app v2 release", area: "Engineering", status: "healthy", due: 33, description: "Native app refresh for employee self-service." },
    { title: "OKR refresh", area: "Leadership", status: "pending", due: 20, description: "Refresh company OKRs for the next cycle." },
    { title: "Expense policy update", area: "Finance", status: "draft", due: 62, description: "Update expense thresholds and the approval workflow." },
  ];
  for (let i = 0; i < initiatives.length; i += 1) {
    const it = initiatives[i];
    const doc = await mkInitiative(it.title, it.area, it.due, it.status, it.description);
    const created = addDays(TODAY, -(90 - i));
    await Initiative.collection.updateOne({ _id: doc._id }, { $set: { createdAt: created, updatedAt: created } });
  }

  // Monthly revenue — 15 months ending this month; the last two steps land on
  // $95,500 → $103,333 so the CEO "Revenue" KPI reads $1.24M annualized with a
  // +8.2% month-over-month trend, matching the Figma board.
  const revValues = [52600, 55200, 58700, 61800, 64900, 68800, 72300, 76100, 79200, 82800, 86200, 89700, 92500, 95500, 103333];
  const revDocs = [];
  for (let i = 0; i < revValues.length; i += 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (revValues.length - 1 - i));
    revDocs.push({ month: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), value: revValues[i] });
  }
  await RevenueRecord.insertMany(revDocs, { ordered: false });

  // Department members + manager backlinks
  for (const [name, users] of Object.entries({
    Leadership: [priya, ravi, nadia, sofia, john],
    Engineering: [mike, david, rachel, marcus, lena, andre, priyanka, omar, hana],
    Marketing: [alex, sarah, tom, maya, noah, chloe, ethan, aisha],
    Design: [nina, jordan, leo, zoe],
    "People Ops": [sana, emily],
    Finance: [daniel, amelia, ashley],
  })) {
    await Department.updateOne({ _id: deps[name]._id }, { members: users.map((u) => u._id), manager: users[0]._id });
  }

  await mongoose.disconnect();
  if (memory) await memory.stop();

  // eslint-disable-next-line no-console
  console.log(`
[seed] done ✔  (password for every demo account: ${PASSWORD})

Demo accounts
  employee        jordan@hexovate.com   Jordan Cole     (Product Designer)
  employee        david@hexovate.com    David Kim       (Backend Engineer)
  manager         mike@hexovate.com     Mike Chen       (Engineering Manager)
  manager          alex@hexovate.com     Alex Rivera     (Head of Marketing & Sales)
  executive       sofia@hexovate.com    Sofia Reyes     (Chief Operating Officer)
  ceo             priya@hexovate.com    Priya Nair      (Chief Executive Officer)
  company_admin   ravi@hexovate.com     Ravi Mehta      (Company Administrator)
  super_admin     nadia@hexovate.com    Nadia Haddad    (Super Administrator)
  hr              sana@hexovate.com     Sana Khalid     (HR Manager)

Run the API with:  npm run dev  (server/)
Frontend at:       http://localhost:5173
`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed:", err);
  process.exit(1);
});
