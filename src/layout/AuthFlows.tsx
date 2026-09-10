import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { authApi } from "../api/auth";
import { isApiError } from "../api/client";
import { Button } from "../components/ui/Button";
import { useToasts } from "../lib/AppProviders";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const { push } = useToasts();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setDone(true);
      if (res.devToken) setDevToken(res.devToken);
      push("Reset link generated", "success");
    } catch (err) {
      push(isApiError(err) ? err.message : "Request failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit}>
        <span className="wordmark login-brand">HEXOVATE</span>
        <h1>Forgot your password?</h1>
        <p className="login-sub">Enter your work email and we&apos;ll send you a reset link.</p>

        {done && !devToken ? (
          <div className="auth-note">
            <MailCheck aria-hidden="true" />
            If an account exists for that email, reset instructions are on their way.
          </div>
        ) : null}
        {devToken ? (
          <div className="auth-note auth-note--dev">
            <KeyRound aria-hidden="true" />
            <span>
              <strong>Development reset link</strong>
              <br />
              No mail server in dev — use this token on the reset page:
            </span>
            <Link className="auth-token" to={`/reset-password?token=${encodeURIComponent(devToken)}`}>Open reset page →</Link>
          </div>
        ) : null}

        {!done ? (
          <div className="field" style={{ marginTop: 6 }}>
            <label htmlFor="fp-email">Work email</label>
            <input id="fp-email" type="email" className="field-input" autoComplete="email" placeholder="you@hexovate.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        ) : null}

        {!done ? (
          <Button variant="primary" size="md" className="login-btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            <MailCheck aria-hidden="true" />
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        ) : null}

        <p className="login-alt">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenFromUrl = params.get("token") || "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToasts();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      push("New password must be at least 10 characters", "error");
      return;
    }
    if (password !== confirm) {
      push("Passwords do not match", "error");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      push("Password reset — you can now sign in", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      push(isApiError(err) ? err.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit}>
        <span className="wordmark login-brand">HEXOVATE</span>
        <h1>Choose a new password</h1>
        <p className="login-sub">Your reset token was verified — set a strong password to continue.</p>

        <div className="field">
          <label htmlFor="rp-token">Reset token</label>
          <input id="rp-token" className="field-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from your email" required />
        </div>
        <div className="field">
          <label htmlFor="rp-pass">New password</label>
          <input id="rp-pass" type="password" className="field-input" autoComplete="new-password" placeholder="At least 10 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="rp-confirm">Confirm password</label>
          <input id="rp-confirm" type="password" className="field-input" autoComplete="new-password" placeholder="Repeat the new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>

        <Button variant="primary" size="md" className="login-btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          <ShieldCheck aria-hidden="true" />
          {busy ? "Resetting…" : "Reset password"}
        </Button>

        <p className="login-alt">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
