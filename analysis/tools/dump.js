const fs = require("fs");
const m = JSON.parse(fs.readFileSync("message.json", "utf8"));
const ncs = m.nodeChanges;
const g = (nc) => (nc && nc.guid ? nc.guid.sessionID + ":" + nc.guid.localID : null);
const pg = (nc) => (nc && nc.parentIndex && nc.parentIndex.guid ? nc.parentIndex.guid.sessionID + ":" + nc.parentIndex.guid.localID : null);
const children = new Map();
for (const nc of ncs) {
  const p = pg(nc);
  if (p) {
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(nc);
  }
}
for (const [p, list] of children)
  list.sort((a, b) => ((((a.parentIndex && a.parentIndex.position) || "") < ((b.parentIndex && b.parentIndex.position) || "")) ? -1 : 1));
const kids = (guid) => children.get(guid) || [];
const chars = (nc) => ((nc.textData && nc.textData.characters) || "").trim();

// DFS first artboard-like screen; prefer wide (desktop) boards
const isScreenName = (nc) => nc.type === "FRAME" && nc.size && nc.size.y > 400 && (nc.name === "artboard" || /^div#/.test(nc.name) || nc.name === "frame" || nc.name === "frame-block");
let best = null;
function findScreen(guid, depth) {
  if (depth > 14) return;
  for (const k of kids(guid)) {
    if (isScreenName(k)) {
      const w = k.size.x;
      if (!best || (w >= 900 && best.size.x < 900) || (w >= 900 === best.size.x >= 900 && w > best.size.x)) best = k;
    } else if (k.type === "FRAME" || k.type === "INSTANCE") {
      findScreen(g(k), depth + 1);
    }
  }
}
function dumpTexts(guid, depth, out, cap) {
  for (const k of kids(guid)) {
    if (out.length >= cap) return;
    if (k.type === "TEXT") {
      const c = chars(k);
      if (c) out.push("  ".repeat(Math.min(depth, 8)) + "- " + JSON.stringify(c.slice(0, 130)));
    } else if (k.type === "FRAME" || k.type === "INSTANCE") {
      if (/^div#/.test(k.name || "")) out.push("  ".repeat(Math.min(depth, 8)) + "[" + k.name + "]");
      dumpTexts(g(k), depth + 1, out, cap);
    }
  }
}

const page = ncs.find((nc) => nc.type === "CANVAS" && nc.name === "Page 1");
let all = "";
for (const grp of kids(g(page))) {
  if (grp.name === "Authentication" || grp.name === "Design") continue;
  best = null;
  findScreen(g(grp), 0);
  all += `\n########## ${grp.name} — first desktop screen ${best ? `"${best.name}" ${Math.round(best.size.x)}x${Math.round(best.size.y)}` : "?"} ##########\n`;
  if (best) {
    const o = [];
    dumpTexts(g(best), 0, o, 170);
    all += o.join("\n");
  }
}
// Design group: component library + assets
const design = ncs.find((nc) => nc.name === "Design");
all += `\n########## Design / Component Library ##########\n`;
if (design) {
  const o = [];
  dumpTexts(g(design), 0, o, 400);
  all += o.join("\n");
}
fs.writeFileSync("C:/Users/Admin/OneDrive/Documents/hexovate erp/analysis/role_dashboards.txt", all);
console.log(all.slice(0, 9000));
