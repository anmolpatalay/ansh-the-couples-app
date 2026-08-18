import { useState } from "react";
import { Auth2 } from "../components/ui/Auth2.jsx";
import Hero26Bg from "../components/ui/Hero26Bg.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
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
    <div className="hero26-shell">
      <Hero26Bg />
      <Auth2
      heading="Create your free account"
      subheading="Join your person on the globe — two cities, one sky."
      submitLabel="Get started for free"
      switchText="Already have an account?"
      switchHref="/login"
      switchLinkLabel="Sign in"
      passwordHint="Use at least 8 characters with a mix of letters and numbers."
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
