import { useState } from "react";
import { Auth2 } from "../components/ui/Auth2.jsx";
import Hero26Bg from "../components/ui/Hero26Bg.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
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
    <div className="hero26-shell">
      <Hero26Bg />
      <Auth2
        heading="Welcome back"
        subheading="Sign in to find each other on the globe."
        submitLabel="Sign in"
        email={email}
        password={password}
        onEmailChange={(e) => setEmail(e.target.value)}
        onPasswordChange={(e) => setPassword(e.target.value)}
        onSubmit={onSubmit}
        busy={busy}
        error={error}
      />
    </div>
  );
}
