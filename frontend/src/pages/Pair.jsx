import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Pair() {
  const { user, reload } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const data = await apiJson("/api/pairing/status");
    setStatus(data);
    if (data.me?.paired) {
      await reload();
      navigate("/");
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  async function sendRequest(e) {
    e.preventDefault();
    setError("");
    try {
      await apiJson("/api/pairing/request", {
        method: "POST",
        body: JSON.stringify({ pair_code: code }),
      });
      setCode("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function decide(requestId, accept) {
    setError("");
    try {
      await apiJson("/api/pairing/decide", {
        method: "POST",
        body: JSON.stringify({ request_id: requestId, accept }),
      });
      await reload();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyCode() {
    const value = user?.pair_code || status?.me?.pair_code;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const pairCode = user?.pair_code || status?.me?.pair_code;

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <p className="eyebrow">find each other</p>
        <h1>Pair with your person</h1>
        <p className="lede">Share your code, or enter theirs. Either of you can send the request.</p>

        <div className="code-box">
          <span>Your pair code</span>
          <strong>{pairCode || "••••••••"}</strong>
          <button type="button" className="ghost" onClick={copyCode}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <form onSubmit={sendRequest} className="pair-form">
          <label>
            Partner’s pair code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter their code"
              required
            />
          </label>
          <button type="submit">Send pair request</button>
        </form>

        {error && <p className="error">{error}</p>}

        {status?.outgoing?.length > 0 && (
          <section>
            <h3>Waiting on them</h3>
            {status.outgoing.map((r) => (
              <p key={r.id} className="muted">
                Request sent to {r.other_name}.
              </p>
            ))}
          </section>
        )}

        {status?.incoming?.length > 0 && (
          <section>
            <h3>Incoming requests</h3>
            {status.incoming.map((r) => (
              <div key={r.id} className="request-row">
                <span>{r.other_name} wants to pair</span>
                <div>
                  <button type="button" onClick={() => decide(r.id, true)}>
                    Accept
                  </button>
                  <button type="button" className="ghost" onClick={() => decide(r.id, false)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
