import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">begin together</p>
        <h1>Join ANSH</h1>
        <p className="lede">Create your space, then invite the person who makes home feel closer.</p>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password (min 8 characters)
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
