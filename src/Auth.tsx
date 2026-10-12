import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Brand } from "./ui";
import { configured } from "./service";
import { signInUsername } from "./authentication";
export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await signInUsername(username, password);
      setPassword("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="auth-layout">
      <Brand />
      <div className="auth-card card">
        <span className="auth-leaf">✦</span>
        <div className="eyebrow">JUST THE TWO OF YOU, AND A LITTLE SUPPORT</div>
        <h1>Your space to grow.</h1>
        <p className="muted">
          A calmer place to focus, celebrate the little wins, and work towards
          something together.
        </p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={64}
              value={username}
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="host, melan or shashi"
            />
          </label>
          <label htmlFor="login-password">Password</label>
          <div className="password-field">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy || !configured}>
            <LockKeyhole size={18} />
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="tiny muted">
          Private accounts · Secure remembered session
        </p>
        <p className="tiny muted">
          Forgot your password? Ask the space owner to reset it.
        </p>
        {!configured && (
          <p className="notice">
            Connection needed. The owner must add the Supabase Project URL and
            publishable key once. See <code>START-HERE.md</code> in the project
            folder. Sign-in will be available after that connection is
            configured.
          </p>
        )}
      </div>
      <p className="auth-bottom">
        A little effort. A shared dream. Our Study Space.
      </p>
    </main>
  );
}
