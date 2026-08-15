import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">two cities, one sky</p>
        <h1>ANSH</h1>
        <p className="lede">Sign in to find each other on the globe.</p>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>
        <p className="switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
