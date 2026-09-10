// Quick probe of the HR portal dashboard endpoint (dev only).
const base = "http://127.0.0.1:4000";
const email = process.argv[2] || "sana@hexovate.com";
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "Password123!" }),
});
const loginBody = await login.json();
const token = loginBody.data?.accessToken || loginBody.data?.token;
if (!token) {
  console.log("LOGIN FAILED", JSON.stringify(loginBody).slice(0, 300));
  process.exit(1);
}
const res = await fetch(`${base}/api/hr/portal/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
if (!body.success) {
  console.log("DASHBOARD FAILED", JSON.stringify(body).slice(0, 300));
  process.exit(1);
}
const p = body.data.portal;
console.log("kpis:", JSON.stringify(p.kpis));
console.log("approvals:", p.approvals.length, "| events:", p.events.length, "| activity:", p.activity.length, "| att:", JSON.stringify(p.attendance));
console.log("announcement:", p.announcement ? p.announcement.title : null);
