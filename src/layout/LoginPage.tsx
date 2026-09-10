import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth, useToasts } from "../lib/AppProviders";
import { isApiError } from "../api/client";

const DEMO_ACCOUNTS = [
  { email: "jordan@hexovate.com", label: "Employee" },
  { email: "mike@hexovate.com", label: "Manager" },
  { email: "sofia@hexovate.com", label: "Executive" },
  { email: "priya@hexovate.com", label: "CEO" },
  { email: "ravi@hexovate.com", label: "Company Admin" },
  { email: "nadia@hexovate.com", label: "Super Admin" },
  { email: "sana@hexovate.com", label: "HR" },
];

/** Minimal sign-in screen (design-system tokens, no shell). */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { push } = useToasts();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      push("Welcome back", "success");
      navigate(from, { replace: true });
    } catch (err) {
      push(isApiError(err) ? err.message : "Login failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit}>
        <span className="wordmark login-brand">HEXOVATE</span>
        <h1>Sign in to your workspace</h1>
        <p className="login-sub">Company ERP — Employee portal</p>

        <div className="field">
          <label htmlFor="li-email">Work email</label>
          <input id="li-email" type="email" className="field-input" autoComplete="email" placeholder="you@hexovate.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="li-password">Password</label>
          <input id="li-password" type="password" className="field-input" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn--primary btn--md login-btn" disabled={busy}>
          <LogIn aria-hidden="true" />
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-alt">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>

        <div className="login-hint">
          <span className="lh-title">Demo accounts</span>
          <span className="lh-row" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="demo-chip"
                title={`${a.label} — password: Password123!`}
                onClick={() => {
                  setEmail(a.email);
                  setPassword("Password123!");
                }}
              >
                <strong>{a.label}</strong>
                <span>{a.email}</span>
              </button>
            ))}
          </span>
          <span className="lh-note">Password for all demo accounts: Password123!</span>
        </div>
      </form>
    </div>
  );
}
