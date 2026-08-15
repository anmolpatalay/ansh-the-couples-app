import { useMemo, useState } from "react";
import { City, Country } from "country-state-city";
import { useNavigate } from "react-router-dom";
import { api, apiJson } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const COUNTRIES = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));

export default function Setup() {
  const { reload, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [countryIso, setCountryIso] = useState("");
  const [city, setCity] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const countryName = COUNTRIES.find((c) => c.isoCode === countryIso)?.name || "";

  const cityOptions = useMemo(() => {
    if (!countryIso) return [];
    const all = City.getCitiesOfCountry(countryIso) || [];
    const unique = [];
    const seen = new Set();
    for (const item of all) {
      const key = item.name;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    unique.sort((a, b) => a.name.localeCompare(b.name));
    return unique;
  }, [countryIso]);

  function onCountry(e) {
    setCountryIso(e.target.value);
    setCity("");
  }

  function onFile(e) {
    const chosen = e.target.files?.[0];
    setFile(chosen || null);
    setPreview(chosen ? URL.createObjectURL(chosen) : "");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!countryIso || !city) {
      setError("Select a country, then a city.");
      return;
    }
    setBusy(true);
    try {
      await apiJson("/api/users/setup", {
        method: "POST",
        body: JSON.stringify({ name, city, country: countryName }),
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
        <p className="lede">Pick your country first, then your city, so we can place you on the globe.</p>
        <form onSubmit={onSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="row">
            <label>
              Country
              <select value={countryIso} onChange={onCountry} required>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <select value={city} onChange={(e) => setCity(e.target.value)} required disabled={!countryIso}>
                <option value="">{countryIso ? "Select city" : "Select a country first"}</option>
                {cityOptions.map((c) => (
                  <option key={`${c.name}-${c.latitude}-${c.longitude}`} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
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
