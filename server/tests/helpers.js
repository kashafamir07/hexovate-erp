import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { Department } from "../src/models/Department.js";
import { Project } from "../src/models/Project.js";
import { Task } from "../src/models/Task.js";
import { User } from "../src/models/User.js";
import { weekStart, addDays } from "../src/utils/ui.js";
import { signAccessToken } from "../src/utils/token.js";

export let app;
export let server;
export let mongo;

export async function startDb() {
  // Never let rate limiters throttle the suite (all requests share one IP).
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
}

export async function stopDb() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

/** Create departments + users; returns token helpers per role. */
export async function seedBase() {
  const hash = await bcrypt.hash("Password123!", 10);
  const mk = (firstName, lastName, email, role, jobTitle, deptId, managerId = null) =>
    User.create({ firstName, lastName, email, passwordHash: hash, role, jobTitle, department: deptId, manager: managerId, status: "active", orgHidden: false });

  const leadership = await Department.create({ name: "Leadership" });
  const engineering = await Department.create({ name: "Engineering" });
  const marketing = await Department.create({ name: "Marketing" });
  const peopleOps = await Department.create({ name: "People Ops" });

  const priya = await mk("Priya", "Nair", "priya@test.com", "admin", "CEO", leadership._id);
  const alex = await mk("Alex", "Rivera", "alex@test.com", "manager", "VP Marketing", leadership._id, priya._id);
  const mike = await mk("Mike", "Chen", "mike@test.com", "manager", "Engineering Manager", engineering._id, priya._id);
  const sarah = await mk("Sarah", "Jenkins", "sarah@test.com", "manager", "Marketing Lead", marketing._id, alex._id);
  const jordan = await mk("Jordan", "Cole", "jordan@test.com", "employee", "Product Designer", engineering._id, mike._id);
  const david = await mk("David", "Kim", "david@test.com", "employee", "Backend Engineer", engineering._id, mike._id);
  const sana = await mk("Sana", "Khalid", "sana@test.com", "hr", "HR Manager", peopleOps._id, priya._id);

  const users = { priya, alex, mike, sarah, jordan, david, sana };
  const token = (u) => signAccessToken(u);
  const auth = (u) => ({ Authorization: `Bearer ${token(u)}` });

  return {
    depts: { leadership, engineering, marketing, peopleOps },
    users,
    mk,
    token,
    auth,
    hash,
  };
}

/** Projects + a handful of tasks for task/project/time tests. */
export async function seedWork(base) {
  const { users } = base;
  const project = await Project.create({
    name: "Website Redesign",
    description: "Marketing site rebuild",
    status: "active",
    priority: "high",
    owner: users.alex._id,
    members: [users.jordan._id, users.david._id, users.sarah._id],
    startDate: addDays(new Date(), -20),
    dueDate: addDays(new Date(), 21),
    budget: 50000,
    spent: 34000,
    progress: 75,
  });
  const erp = await Project.create({
    name: "ERP Implementation",
    description: "Internal rollout",
    status: "active",
    priority: "medium",
    owner: users.mike._id,
    members: [users.mike._id, users.jordan._id, users.david._id],
    startDate: addDays(new Date(), -30),
    dueDate: addDays(new Date(), 88),
    budget: 120000,
    progress: 30,
  });

  const mkTask = (title, proj, assignee, status, priority, dueOffset, opts = {}) =>
    Task.create({
      title,
      project: proj._id,
      assignedTo: assignee._id,
      createdBy: proj.owner,
      status,
      priority,
      dueDate: addDays(new Date(), dueOffset),
      labels: opts.labels || [],
      description: opts.description || "",
      completedAt: opts.completed ? new Date() : null,
    });

  const t1 = await mkTask("Design pricing page", project, users.jordan, "in_progress", "medium", 12, { labels: ["Design"] });
  const t2 = await mkTask("Write homepage copy", project, users.sarah, "review", "high", 11);
  const t3 = await mkTask("Build nav component", project, users.david, "completed", "high", -5, { completed: true });
  const t4 = await mkTask("SSO config", erp, users.jordan, "todo", "high", 15);
  return { project, erp, tasks: { t1, t2, t3, t4 } };
}

export const today = () => new Date();
export const thisWeek = () => weekStart(new Date());
