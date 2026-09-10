// Builds hierarchy from message.json nodeChanges (parentIndex.guid, sort by position)
// and prints an indented inventory of frame-like nodes with sizes and text counts.
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("message.json", "utf8"));
const ncs = m.nodeChanges;
const g = (nc) => (nc && nc.guid ? nc.guid.sessionID + ":" + nc.guid.localID : null);
const pg = (nc) => (nc && nc.parentIndex && nc.parentIndex.guid ? nc.parentIndex.guid.sessionID + ":" + nc.parentIndex.guid.localID : null);

const byGuid = new Map();
const children = new Map(); // parentGuid -> [nc]
for (const nc of ncs) {
  byGuid.set(g(nc), nc);
  const p = pg(nc);
  if (p) {
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(nc);
  }
}
for (const [p, list] of children) {
  list.sort((a, b) => {
    const pa = (a.parentIndex && a.parentIndex.position) || "";
    const pb = (b.parentIndex && b.parentIndex.position) || "";
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
}
const kids = (guid) => children.get(guid) || [];

function fmtSize(nc) {
  if (!nc.size) return "";
  const s = nc.size;
  return ` [${Math.round(s.x)}×${Math.round(s.y)}]`;
}

const statsMemo = new Map();
function stats(guid) {
  if (statsMemo.has(guid)) return statsMemo.get(guid);
  let t = { text: 0, inst: 0, nodes: 1 };
  for (const k of kids(guid)) {
    const s = stats(g(k));
    t.text += s.text + (k.type === "TEXT" ? 1 : 0);
    t.inst += s.inst + (k.type === "INSTANCE" ? 1 : 0);
    t.nodes += s.nodes;
  }
  statsMemo.set(guid, t);
  return t;
}

let out = [];
function walk(guid, depth, maxDepth) {
  for (const k of kids(guid)) {
    const st = stats(g(k));
    const meta = [fmtSize(k), `${st.text} txt`, st.inst ? `${st.inst} inst` : ""].filter(Boolean).join(" ");
    out.push("  ".repeat(depth) + `• ${k.type} "${k.name || "(unnamed)"}" ${meta}`);
    if (depth < maxDepth) walk(g(k), depth + 1, maxDepth);
  }
}

const maxDepth = parseInt(process.argv[2] || "3", 10);
const page = ncs.find((nc) => nc.type === "CANVAS" && nc.name === "Page 1");
out.push(`== Page 1 ==`);
walk(g(page), 0, maxDepth);
fs.writeFileSync("tree.txt", out.join("\n"));
console.log(`wrote tree.txt: ${out.length} lines`);
