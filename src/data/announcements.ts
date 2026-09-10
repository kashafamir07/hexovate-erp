export interface Announcement {
  id: string;
  author: string;
  authorInitials: string;
  meta: string;
  title: string;
  body: string;
  pinned?: boolean;
}

export const announcements: Announcement[] = [
  {
    id: "a1",
    author: "People Ops",
    authorInitials: "HR",
    meta: "Pinned",
    title: "Office closed Nov 28 — Thanksgiving",
    body: "The New York and Austin offices will be closed on Thursday, November 28. Remote employees may also take the day off. Standard holiday schedule applies.",
    pinned: true,
  },
  {
    id: "a2",
    author: "Finance Team",
    authorInitials: "HR",
    meta: "2 days ago",
    title: "New expense tool rollout",
    body: "Starting next Monday, all expense submissions move to the new module inside My Requests. The old spreadsheet process will be retired.",
  },
  {
    id: "a3",
    author: "Priya Nair",
    authorInitials: "HR",
    meta: "5 days ago",
    title: "Q4 all-hands — Nov 5, 10:00 AM",
    body: "Join the full-company update covering roadmap, hiring, and Q4 goals. Calendar invite has been sent to all employees.",
  },
];
