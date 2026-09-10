// Ordered screen inventory: walks each role group; pairs artboard-like frames
// (height > 500) with the nearest preceding TEXT caption; falls back to node name.
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
  list.sort((a, b) => (((a.parentIndex && a.parentIndex.position) || "") < ((b.parentIndex && b.parentIndex.position) || "") ? -1 : 1));
const kids = (guid) => children.get(guid) || [];
const chars = (nc) => ((nc.textData && nc.textData.characters) || "").trim();
const isScreenish = (nc) => nc.size && nc.size.y > 500 && (nc.type === "FRAME" || nc.type === "INSTANCE");

const lines = [];
function walk(guid, lastLabel, depth) {
  for (const kid of kids(guid)) {
    if (kid.type === "TEXT") {
      const c = chars(kid);
      if (c && c.length < 200 && !kid.derivedTextData) lastLabel = c;
      continue;
    }
    if (kid.type === "VECTOR" || kid.type === "ROUNDED_RECTANGLE") continue;
    if (isScreenish(kid)) {
      // Is it a leaf screen (no screen-sized children)?
      const sub = kids(g(kid)).filter(isScreenish);
      if (sub.length === 0) {
        const w = Math.round(kid.size.x);
        const device = w <= 480 ? "MOBILE" : "DESKTOP";
        const namePart = kid.name && /div#/.test(kid.name) ? kid.name : "";
        lines.push(`${device}\t${namePart || (lastLabel || "(unnamed)")}\t[${w}×${Math.round(kid.size.y)}]`);
      } else {
        walk(g(kid), lastLabel, depth + 1);
      }
    } else if (kid.type === "FRAME" || kid.type === "INSTANCE" || kid.type === "SYMBOL") {
      walk(g(kid), lastLabel, depth + 1);
    }
  }
}

const page = ncs.find((nc) => nc.type === "CANVAS" && nc.name === "Page 1");
const top = kids(g(page));
let out = [];
for (const group of top) {
  const buf = [];
  const saved = lines.length;
  lines.push(`######## ${group.name} (${Math.round(group.size.x)}×${Math.round(group.size.y)}) ########`);
  walk(g(group), "", 0);
  // dedupe consecutive identical labels (pair repeats)
  out = out.concat(lines.splice(saved));
}
fs.writeFileSync("screens.txt", out.join("\n"));
console.log("wrote screens.txt:", out.length, "lines");
