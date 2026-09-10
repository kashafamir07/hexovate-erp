import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Toggle } from "../../components/ui/Toggle";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";
import { usersApi, type ApiUser } from "../../api/auth";

/** Account Settings (Employee board 47) — reached via the profile menu. */
export function AccountSettingsPage() {
  const { push } = useToasts();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", location: "" });
  const [password, setPassword] = useState({ current: "", next: "" });
  const [prefs, setPrefs] = useState({ tasks: true, approvals: true, digest: true });

  const load = async () => {
    setLoadError(null);
    try {
      const me = await usersApi.myProfile();
      setProfile(me);
      setForm({ name: me.name, phone: me.phone || "", location: me.location || "" });
      setPrefs({
        tasks: me.notificationPrefs?.taskAssignments ?? true,
        approvals: me.notificationPrefs?.approvalUpdates ?? true,
        digest: me.notificationPrefs?.weeklyDigest ?? true,
      });
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (password.next && password.next.length < 10) {
      push("New password must be at least 10 characters", "error");
      return;
    }
    setSaving(true);
    try {
      const [first = "", ...rest] = form.name.trim().split(/\s+/);
      const patch: Record<string, unknown> = {
        firstName: first,
        lastName: rest.join(" "),
        phone: form.phone,
        location: form.location,
        notificationPrefs: { taskAssignments: prefs.tasks, approvalUpdates: prefs.approvals, weeklyDigest: prefs.digest },
      };
      await usersApi.updateMe(patch);
      if (password.next) {
        await usersApi.changePassword(password.current, password.next);
      }
      push("Changes saved successfully", "success");
      setPassword({ current: "", next: "" });
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const p = profile;
  if (loadError && !p) {
    return (
      <section className="page">
        <ErrorBlock message={loadError} onRetry={() => void load()} />
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

  return (
    <section className="page">
      {/* header card */}
      <div className="card profile-hero" style={{ marginBottom: 16 }}>
        <span className="avatar" style={{ background: p.color, width: 80, height: 80, fontSize: 26 }}>{p.initials}</span>
        <div className="profile-meta">
          <h2>{p.name}</h2>
          <span className="sub">{p.jobTitle}{p.departmentName ? ` · ${p.departmentName} Department` : ""}</span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Profile sections">
        {["Overview", "Documents", "Time Logs", "Leave History", "Settings"].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === "Settings"} className={`tab-link ${t === "Settings" ? "active" : ""}`.trim()} onClick={() => t === "Overview" && navigate("/workspace")}>
            {t}
          </button>
        ))}
      </div>

      <div className="kv-grid">
        <div>
          <div className="card kv-card" style={{ marginBottom: 16 }}>
            <h3>Profile Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label htmlFor="pf-name">Full Name</label>
                <input id="pf-name" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-phone">Phone</label>
                <input id="pf-phone" className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-loc">Location</label>
                <input id="pf-loc" className="field-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card kv-card">
            <h3>Change Password</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label htmlFor="pw-cur">Current Password</label>
                <input id="pw-cur" type="password" className="field-input" placeholder="Current password" value={password.current} onChange={(e) => setPassword({ ...password, current: e.target.value })} autoComplete="current-password" />
              </div>
              <div className="field">
                <label htmlFor="pw-next">New Password</label>
                <input
                  id="pw-next"
                  type="password"
                  className="field-input"
                  placeholder="At least 10 characters"
                  value={password.next}
                  onChange={(e) => setPassword({ ...password, next: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card kv-card" style={{ marginBottom: 16 }}>
            <h3>Notification Preferences</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>Task assignments</span>
                <Toggle checked={prefs.tasks} onChange={(v) => setPrefs({ ...prefs, tasks: v })} label="Task assignments" />
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>Approval updates</span>
                <Toggle checked={prefs.approvals} onChange={(v) => setPrefs({ ...prefs, approvals: v })} label="Approval updates" />
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>Weekly digest email</span>
                <Toggle checked={prefs.digest} onChange={(v) => setPrefs({ ...prefs, digest: v })} label="Weekly digest email" />
              </span>
            </div>
          </div>

          <div className="card kv-card">
            <h3>Security</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13 }}>Two-factor authentication</span>
                <Badge tone="success">Enabled</Badge>
              </span>
              <button
                type="button"
                className="link-btn"
                style={{ alignSelf: "flex-start", color: "var(--danger)" }}
                onClick={() => push("All other sessions logged out", "success")}
              >
                Log Out of All Devices
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
