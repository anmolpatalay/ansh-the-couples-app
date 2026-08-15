import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiJson } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Setup() {
  const { reload } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onFile(e) {
    const chosen = e.target.files?.[0];
    setFile(chosen || null);
    setPreview(chosen ? URL.createObjectURL(chosen) : "");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiJson("/api/users/setup", {
        method: "POST",
        body: JSON.stringify({ name, city, country }),
      });
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const res = await api("/api/users/me/picture", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Could not upload picture");
        }
      }
      await reload();
      navigate("/pair");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <p className="eyebrow">first login</p>
        <h1>Tell ANSH who you are</h1>
        <p className="lede">Your city places you on the globe. Your pair code appears after this.</p>
        <form onSubmit={onSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="row">
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} required />
            </label>
            <label>
              Country
              <input value={country} onChange={(e) => setCountry(e.target.value)} required />
            </label>
          </div>
          <label>
            Profile picture
            <input type="file" accept="image/*" onChange={onFile} />
          </label>
          {preview && <img src={preview} alt="Preview" className="avatar-preview" />}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save and get my code"}
          </button>
        </form>
      </div>
    </div>
  );
}
