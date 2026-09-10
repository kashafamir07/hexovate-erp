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

let out = "";

// 1. Components: SYMBOLs (definition canvas) + INSTANCE usage counts
const symbols = ncs.filter((nc) => nc.type === "SYMBOL");
const symKey = (nc) => (nc.key || g(nc));
const usage = new Map();
for (const inst of ncs.filter((nc) => nc.type === "INSTANCE")) {
  const k = inst.componentKey || (inst.symbolData && inst.symbolData.symbolID ? g(inst.symbolData.symbolID) : null) || "?";
  usage.set(k, (usage.get(k) || 0) + 1);
}
out += `# COMPONENTS (${symbols.length} symbols)\n`;
const symByName = new Map();
for (const s of symbols) {
  const k = s.key || g(s);
  if (!symByName.has(s.name)) symByName.set(s.name, []);
  symByName.get(s.name).push({ k, usages: usage.get(k) || 0 });
}
for (const [name, list] of [...symByName.entries()].sort()) {
  const total = list.reduce((a, b) => a + b.usages, 0);
  out += `${name}\tuses=${total} defs=${list.length}\n`;
}

// 2. Variable sets & variables (design tokens)
out += `\n# VARIABLE SETS\n`;
const vsetNames = new Map();
for (const vs of ncs.filter((nc) => nc.type === "VARIABLE_SET")) {
  vsetNames.set(g(vs), vs.name);
  out += `${vs.name}\n`;
}
function colorStr(c) {
  if (!c) return null;
  const r = Math.round((c.r ?? 0) * 255), gg = Math.round((c.g ?? 0) * 255), b = Math.round((c.b ?? 0) * 255);
  return `rgba(${r},${gg},${b},${c.a ?? 1}) #${[r, gg, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
out += `\n# VARIABLES\n`;
for (const v of ncs.filter((nc) => nc.type === "VARIABLE")) {
  const set = v.variableSetID ? vsetNames.get(g(v.variableSetID)) : "?";
  const val = v.variableDataValues && v.variableDataValues.entries && v.variableDataValues.entries[0] && v.variableDataValues.entries[0].variableData && v.variableDataValues.entries[0].variableData.value;
  let vs = "?";
  if (val) {
    if (val.colorValue) vs = colorStr(val.colorValue);
    else if (val.floatValue !== undefined) vs = String(val.floatValue);
    else if (val.stringValue !== undefined) vs = JSON.stringify(val.stringValue);
    else vs = JSON.stringify(val);
  }
  out += `${v.name}\t(${v.variableResolvedType})\t${vs}\t[set: ${set}]\n`;
}

// 3. Font usage histogram (text nodes)
out += `\n# FONTS (fontFamily / style: count)\n`;
const fonts = new Map();
for (const t of ncs.filter((nc) => nc.type === "TEXT")) {
  const f = t.fontName || {};
  const key = `${f.family || "?"} / ${f.style || "?"}`;
  fonts.set(key, (fonts.get(key) || 0) + 1);
}
for (const [f, c] of [...fonts.entries()].sort((a, b) => b[1] - a[1])) out += `${f}\t${c}\n`;

// 4. Solid fill colors histogram on frames/vectors
out += `\n# TOP SOLID FILL COLORS (node count)\n`;
const fills = new Map();
const addCol = (col, cnt) => {
  if (!col) return;
  const key = colorStr(col);
  if (!key) return;
  fills.set(key, (fills.get(key) || 0) + cnt);
};
for (const nc of ncs) {
  if (!nc.fillPaints) continue;
  for (const p of nc.fillPaints) {
    if (p.type === "SOLID" && p.visible !== false) addCol(p.color, 1);
  }
}
for (const [c, n] of [...fills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) out += `${c}\t${n}\n`;

fs.writeFileSync("C:/Users/Admin/OneDrive/Documents/hexovate erp/analysis/tokens_components.txt", out);
console.log(out.length, "chars written");
