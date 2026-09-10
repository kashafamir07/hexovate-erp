/**
 * Per-route chrome info used by the top bar / mobile titles.
 * `match`: function receiving location.pathname; returns config or undefined.
 */
export interface RouteMeta {
  /** top bar text (breadcrumb). Multi-part looks like "Projects / X" */
  crumb: string;
  /** main title shown on mobile top bar & as H1 where the page provides none */
  mobileTitle: string;
  /** active nav/tab id when this route is open */
  activeId: string;
  /** 12px gray detail-style crumb (vs 14px semibold page crumb) */
  detail?: boolean;
}

const exact = (path: string) => (loc: string) => loc === path;

/** Path matching order matters: most specific first. */
export const routeMeta: { match: (path: string) => boolean; meta: RouteMeta }[] = [
  {
    match: (p) => /^\/projects\/[^/]+\/board$/.test(p),
    meta: { crumb: "Projects / Website Redesign / Board", mobileTitle: "Board", activeId: "projects", detail: true },
  },
  {
    match: (p) => /^\/projects\/[^/]+$/.test(p),
    meta: { crumb: "Projects / Website Redesign", mobileTitle: "Website Redesign", activeId: "projects", detail: true },
  },
  { match: exact("/dashboard"), meta: { crumb: "Dashboard", mobileTitle: "HEXOVATE", activeId: "dashboard" } },
  { match: exact("/workspace"), meta: { crumb: "Personal Workspace", mobileTitle: "Personal Workspace", activeId: "workspace" } },
  { match: exact("/org-chart"), meta: { crumb: "Org Chart", mobileTitle: "Org Chart", activeId: "org-chart" } },
  { match: exact("/projects"), meta: { crumb: "Projects", mobileTitle: "Projects", activeId: "projects" } },
  { match: exact("/my-tasks"), meta: { crumb: "My Tasks", mobileTitle: "My Tasks", activeId: "my-tasks" } },
  { match: exact("/time-tracker"), meta: { crumb: "Time Tracker", mobileTitle: "Time Tracker", activeId: "time-tracker" } },
  { match: exact("/time-tracker/timesheet"), meta: { crumb: "Time Tracker / Weekly Timesheet", mobileTitle: "Timesheet", activeId: "time-tracker", detail: true } },
  { match: exact("/messages"), meta: { crumb: "Messages", mobileTitle: "Messages", activeId: "messages" } },
  { match: exact("/announcements"), meta: { crumb: "Announcements", mobileTitle: "Announcements", activeId: "announcements" } },
  { match: exact("/my-requests"), meta: { crumb: "My Requests", mobileTitle: "My Requests", activeId: "my-requests" } },
  { match: exact("/account"), meta: { crumb: "Personal Workspace / Settings", mobileTitle: "Settings", activeId: "workspace", detail: true } },
];

export function findRouteMeta(pathname: string): RouteMeta {
  for (const { match, meta } of routeMeta) if (match(pathname)) return meta;
  return { crumb: "Dashboard", mobileTitle: "HEXOVATE", activeId: "dashboard" };
}
