import { useEffect, useState } from "react";
import { api, apiJson } from "../api.js";

export default function Photos() {
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function load() {
    const data = await apiJson("/api/photos");
    const withBlobs = await Promise.all(
      data.photos.map(async (p) => {
        const res = await api(p.url);
        const blob = await res.blob();
        return { ...p, blobUrl: URL.createObjectURL(blob) };
      })
    );
    setPhotos((prev) => {
      prev.forEach((p) => p.blobUrl && URL.revokeObjectURL(p.blobUrl));
      return withBlobs;
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    return () => {
      setPhotos((prev) => {
        prev.forEach((p) => p.blobUrl && URL.revokeObjectURL(p.blobUrl));
        return [];
      });
    };
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("note", note);
      const res = await api("/api/photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not add photo");
      setFile(null);
      setNote("");
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await apiJson(`/api/photos/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Us in photos</h1>
        <p>A shared album. Notes are optional — the picture can speak for itself.</p>
      </div>

      <form className="photo-form" onSubmit={add}>
        <label>
          Photo
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line about this moment" />
        </label>
        <button type="submit" disabled={busy || !file}>
          {busy ? "Adding…" : "Add photo"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="photo-grid">
        {photos.map((p) => (
          <figure key={p.id} className="photo-card">
            <button type="button" className="photo-thumb" onClick={() => setOpen(p)}>
              <img src={p.blobUrl} alt={p.note || "Us"} />
            </button>
            {p.note ? <figcaption>{p.note}</figcaption> : null}
            <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
              Delete
            </button>
          </figure>
        ))}
      </div>

      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" className="lightbox-close" onClick={() => setOpen(null)} aria-label="Close">
            Close
          </button>
          <img
            src={open.blobUrl}
            alt={open.note || "Us"}
            onClick={(e) => e.stopPropagation()}
          />
          {open.note ? <p className="lightbox-note">{open.note}</p> : null}
        </div>
      )}
    </div>
  );
}
