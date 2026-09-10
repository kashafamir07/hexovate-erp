import type { Person } from "../types";

/** People referenced across Employee screens (initials & avatar colors from Figma). */
export const people: Record<string, Person> = {
  jordan: { initials: "JC", name: "Jordan Cole", role: "Product Designer", color: "#1F3C88" },
  sarah: { initials: "SJ", name: "Sarah Jenkins", role: "Marketing Lead", color: "#2E86AB" },
  mike: { initials: "MC", name: "Mike Chen", role: "Engineering Manager", color: "#16A34A" },
  alex: { initials: "AR", name: "Alex Rivera", role: "VP Marketing & Sales", color: "#6D28D9" },
  priya: { initials: "PN", name: "Priya Nair", role: "Chief Executive Officer", color: "#1F3C88" },
  tom: { initials: "TB", name: "Tom Baxter", role: "Sales Executive", color: "#B45309" },
  david: { initials: "DK", name: "David Kim", role: "Backend Engineer", color: "#2E86AB" },
};

export interface OrgNode extends Person {
  id: string;
  reports?: string[];
  reportsCount?: number;
}

/** Org chart (Employee board 15). Nodes nest by id. */
export const orgChartRoot: OrgNode = {
  id: "priya",
  ...people.priya,
  reports: ["alex", "mike"],
  reportsCount: 4,
};

export const orgChart: Record<string, OrgNode> = {
  priya: { id: "priya", ...people.priya, reports: ["alex", "mike"], reportsCount: 4 },
  alex: { id: "alex", ...people.alex, reports: ["sarah", "tom"], reportsCount: 5 },
  mike: { id: "mike", ...people.mike, reports: ["jordan", "david"], reportsCount: 6 },
  sarah: { id: "sarah", ...people.sarah, reportsCount: 2 },
  tom: { id: "tom", ...people.tom },
  jordan: { id: "jordan", ...people.jordan },
  david: { id: "david", ...people.david },
};
