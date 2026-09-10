/** Trigger a client-side CSV download from column headers + row cells. */
export function downloadCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Open a printable window with a plain table (report Print). */
export function printTable(title: string, subtitle: string, columns: string[], rows: (string | number)[][]) {
  const esc = (s: string | number) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Inter,'Segoe UI',sans-serif;color:#1e293b;padding:24px}
    h1{font-size:18px;margin:0 0 4px} p{margin:0 0 18px;color:#64748b;font-size:12px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #e2e8f0;padding:6px 9px;text-align:left} th{background:#f1f5f9}
    tr:nth-child(even) td{background:#fafafa}
  </style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)}</p>
  <table><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <script>window.onload=function(){window.print()}<\\/script></body></html>`);
  win.document.close();
}

export function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function greeting(firstName?: string): string {
  const h = new Date().getHours();
  const name = firstName ? `, ${firstName}` : "";
  return h < 12 ? `Good morning${name}` : h < 17 ? `Good afternoon${name}` : `Good evening${name}`;
}

/** ISO date for an offset in days (input type=date) */
export function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
