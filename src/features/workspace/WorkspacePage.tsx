import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, FileText, History } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useAuth } from "../../lib/AppProviders";
import { usersApi, type ApiUser } from "../../api/auth";

const tabs = ["Overview", "Documents", "Time Logs", "Leave History", "Settings"] as const;
type Tab = (typeof tabs)[number];

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const tenure = (iso?: string | null) => {
  if (!iso) return "—";
  const start = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years > 0) return `${years}y ${months}m`;
  return `${months}m`;
};

/** Personal Workspace (Employee board 09) — profile summary + overview tab. */
export function WorkspacePage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = async () => {
    setError(null);
    try {
      const me = await usersApi.myProfile();
      setProfile(me);
      const projects = await usersApi.myProjects();
      setProjectsCount(projects.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your profile");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const p = profile ?? user;

  if (error && !p) {
    return (
      <section className="page">
        <ErrorBlock message={error} onRetry={() => void load()} />
      </section>
    );
  }
  if (!p) {
    return (
      <section className="page">
        <LoadingBlock rows={4} />
      </section>
    );
  }

  const track = p.departmentName.replace(/\s*Department$/i, "") || "General";

  return (
    <section className="page">
      {/* Profile hero card */}
      <div className="card profile-hero" style={{ marginBottom: 16 }}>
        <span className="avatar avatar-lg" style={{ background: p.color, width: 80, height: 80, fontSize: 26 }}>{p.initials}</span>
        <div className="profile-meta">
          <h2>{p.name}</h2>
          <span className="sub">{p.jobTitle}{p.departmentName ? ` · ${p.departmentName} Department` : ""}</span>
          <span>
            <Badge tone={p.status === "active" ? "success" : "gray"}>{p.status === "active" ? "Active" : p.status}</Badge>
          </span>
        </div>
        <div className="hero-actions">
          <Button variant="soft" onClick={() => navigate("/account")}>
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Highlight tiles */}
      <div className="stat-tiles-3">
        {[
          { num: String(projectsCount ?? "—"), lbl: "Active Projects" },
          { num: track, lbl: "Primary Track", small: true },
          { num: tenure(p.joinedAt), lbl: "Tenure", small: true },
        ].map((s) => (
          <div className="card profile-tile" key={s.lbl}>
            <span className="num" style={s.small ? { fontSize: 24 } : undefined}>{s.num}</span>
            <span className="lbl">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab-link ${tab === t ? "active" : ""}`.trim()} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="kv-grid">
          <div>
            <div className="card kv-card" style={{ marginBottom: 16 }}>
              <h3>Contact Information</h3>
              <dl className="kv-list">
                <div className="kv-row"><dt>Work Email</dt><dd>{p.email}</dd></div>
                <div className="kv-row"><dt>Phone</dt><dd>{p.phone || "—"}</dd></div>
                <div className="kv-row"><dt>Location</dt><dd>{p.location || "—"}</dd></div>
              </dl>
            </div>

            <div className="card kv-card">
              <h3>Skills</h3>
              <div className="skills-row">
                {p.skills && p.skills.length > 0 ? p.skills.map((s) => (
                  <span className="chip" key={s}>{s}</span>
                )) : <span className="cell-muted">No skills listed yet.</span>}
              </div>
            </div>
          </div>

          <div>
            <div className="card kv-card" style={{ marginBottom: 16 }}>
              <h3>Employment Details</h3>
              <dl className="kv-list">
                <div className="kv-row"><dt>Manager</dt><dd>{p.managerName || "—"}</dd></div>
                <div className="kv-row"><dt>Start Date</dt><dd>{fmtDate(p.joinedAt)}</dd></div>
                <div className="kv-row"><dt>Employment Type</dt><dd>Full-time</dd></div>
              </dl>
            </div>

            <div className="card kv-card">
              <h3>Emergency Contact</h3>
              <dl className="kv-list">
                <div className="kv-row"><dt>Name</dt><dd>{p.emergencyContact?.name || "—"}</dd></div>
                <div className="kv-row"><dt>Phone</dt><dd>{p.emergencyContact?.phone || "—"}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      ) : tab === "Documents" ? (
        <EmptyState icon={FileText} title="No documents uploaded yet" body="Documents shared by HR or your manager will appear here." />
      ) : tab === "Time Logs" ? (
        <EmptyState
          icon={Clock}
          title="Your time logs"
          body="Open the Time Tracker to review entries or the weekly timesheet."
          action={
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button onClick={() => navigate("/time-tracker")}>Open Time Tracker</Button>
              <Button variant="soft" onClick={() => navigate("/time-tracker/timesheet")}>Weekly Timesheet</Button>
            </div>
          }
        />
      ) : tab === "Leave History" ? (
        <EmptyState icon={History} title="No leave history yet" body="Submitted leave requests and balances will be listed here." />
      ) : (
        <EmptyState
          icon={FileText}
          title="Account settings"
          body="Manage your profile details, password and notification preferences."
          action={
            <div style={{ marginTop: 6 }}>
              <Button onClick={() => navigate("/account")}>Open Settings</Button>
            </div>
          }
        />
      )}
    </section>
  );
}
